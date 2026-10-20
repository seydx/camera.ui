import { performance } from 'node:perf_hooks';

import { WorkerCapability, workloadKey } from '../types.js';
import { idlePlacement, reducePlacement } from './placement.js';
import { STARTED_DEADLINE_MS, STORE_REPORT_WAIT_MS } from './timing.js';

import type { Logger } from '@camera.ui/common/logger';
import type { WorkerManager } from '../manager.js';
import type { Placement, PlacementEffect, PlacementEvent, PlacementPhase, RemotePhase } from './placement.js';

export type PlacementDecision =
  | { host: 'master'; reason?: string }
  | { host: 'worker'; agentId: string }
  | { host: 'wait-release'; agentId: string; seq: number }
  | { host: 'wait-worker'; agentId: string; reason: string };

export interface PlacementOwner {
  readonly key: string;
  readonly label: string;
  readonly host: string | undefined;
  readonly waitingFor: string | undefined;
  handle(event: PlacementEvent): void;
  reconsider(reason: string): void;
  restart(reason: string): void;
}

export interface PlacementInfo {
  host: string;
  worker?: string;
  phase: PlacementPhase;
  reason?: string;
  instanceId?: string;
  attempts?: number;
  since: number;
}

export interface PlacementConsumer {
  runLocal(reason: string): void;
  stopLocal(reason: string): Promise<void>;
  handshake(instanceId: string | undefined): void;
  resume(instanceId: string): void;
  lost(reason: string): void;
  changed(info: PlacementInfo): void;
}

export type PlaceResult = 'local' | 'remote' | 'waiting';

export class LocalStartAbandoned extends Error {}

const DROP_FIRST_READY = process.env.CAMERAUI_DIAG_LIFECYCLE === '1' && process.env.CAMERAUI_DIAG_DROP_READY === '1';
const droppedReady = new Set<string>();

const ON_WORKER: ReadonlySet<RemotePhase> = new Set(['pending', 'provisioning', 'spawned', 'adopting', 'handshaking', 'bound', 'restarting', 'held', 'failed']);

function mono(): number {
  return performance.now();
}

function idOf(instanceId: string | undefined): string | undefined {
  return instanceId === '' ? undefined : instanceId;
}

export class RemotePlacement implements PlacementOwner {
  public readonly key: string;

  private placement: Placement = idlePlacement(mono());
  private local = false;
  private localSince = Date.now();
  private wanted = false;
  private detached = false;
  private shown?: { agentId: string; instanceId?: string; version?: string };
  private reportWaiters = new Set<() => void>();

  constructor(
    private readonly capability: WorkerCapability,
    private readonly id: string,
    public label: string,
    private readonly consumer: PlacementConsumer,
    private readonly logger: Logger,
    private readonly manager: () => WorkerManager | undefined,
  ) {
    this.key = workloadKey(capability, id);
  }

  public get host(): string | undefined {
    if (this.local) {
      return 'master';
    }
    return ON_WORKER.has(this.placement.phase) ? this.placement.agentId : undefined;
  }

  public get waitingFor(): string | undefined {
    return this.placement.phase === 'waiting-for-worker' ? this.placement.agentId : undefined;
  }

  public get remote(): boolean {
    return !this.local && this.placement.phase !== 'idle';
  }

  public get phase(): PlacementPhase {
    return this.local ? 'local' : this.placement.phase;
  }

  public get agentId(): string | undefined {
    return this.local ? undefined : this.placement.agentId;
  }

  public get gen(): string | undefined {
    return this.placement.gen;
  }

  public get boundInstance(): string | undefined {
    return this.placement.bound;
  }

  public get handshakeInstance(): string | undefined {
    return this.placement.handshake;
  }

  public get boundVersion(): string | undefined {
    const { bound, agentId } = this.placement;
    const shown = this.shown;
    if (this.local || !bound || !shown || shown.agentId !== agentId || shown.instanceId !== bound) {
      return undefined;
    }
    return shown.version;
  }

  public get info(): PlacementInfo {
    if (this.local) {
      return { host: 'master', phase: 'local', since: this.localSince };
    }
    const p = this.placement;
    return {
      host: p.agentId ?? 'master',
      worker: p.agentId ? this.manager()?.nameOf(p.agentId) : undefined,
      phase: p.phase,
      reason: p.reason,
      instanceId: p.bound ?? p.handshake ?? p.reported,
      attempts: p.attempts || undefined,
      since: Math.round(Date.now() - (mono() - p.since)),
    };
  }

  public async owns(instanceId: string): Promise<boolean> {
    if (!this.local && this.placement.agentId && !this.shown) {
      await this.nextReport(STORE_REPORT_WAIT_MS);
    }
    const p = this.placement;
    return !this.local && (instanceId === p.bound || instanceId === p.handshake || instanceId === p.reported || instanceId === this.shown?.instanceId);
  }

  public place(reason: string, fresh = false): PlaceResult {
    this.wanted = true;
    this.detached = false;
    const manager = this.manager();
    if (!manager) {
      this.setLocal(true);
      return 'local';
    }
    manager.register(this);
    return this.apply(manager.decide(this.capability, this.id), reason, fresh, true);
  }

  public stop(): 'local' | 'releasing' | 'stopped' {
    this.wanted = false;
    if (this.local) {
      this.setLocal(false);
      return 'local';
    }
    if (this.placement.phase === 'idle') {
      return 'stopped';
    }
    if (this.placement.phase === 'releasing') {
      return 'releasing';
    }

    const seq = this.manager()?.release(this.capability, this.id);
    if (seq === undefined) {
      this.reduce({ type: 'reset', now: mono() });
      return 'stopped';
    }
    this.reduce({ type: 'release', now: mono(), seq });
    return 'releasing';
  }

  public detach(): void {
    this.detached = true;
  }

  public close(): void {
    this.wanted = false;
    this.manager()?.unregister(this);
  }

  public restart(reason: string): void {
    const agentId = this.placement.agentId;
    if (!this.wanted || this.local || !agentId || !ON_WORKER.has(this.placement.phase)) {
      return;
    }
    this.manager()?.clearFailure(this.capability, this.id);
    this.logger.log(`Restarting ${this.label} on worker ${this.workerName(agentId)}: ${reason}`);
    this.placeOn(agentId, true, reason);
  }

  public reconsider(reason: string): void {
    const manager = this.manager();
    if (!this.wanted || this.detached || !manager) {
      return;
    }
    this.apply(manager.decide(this.capability, this.id), reason, false, false);
  }

  public handle(event: PlacementEvent): void {
    if (event.type === 'report' && this.placement.agentId) {
      this.shown = { agentId: this.placement.agentId, instanceId: event.report?.instanceId, version: event.report?.version };
      for (const done of [...this.reportWaiters]) {
        done();
      }
    }
    if (!this.detached) {
      this.reduce(event);
    }
  }

  public ready(instanceId?: string, handshake?: number): boolean {
    if (this.local) {
      return false;
    }
    if (DROP_FIRST_READY && instanceId && !droppedReady.has(instanceId)) {
      droppedReady.add(instanceId);
      this.logger.warn(`Diag: dropped the first READY of instance ${instanceId}`);
      return true;
    }
    this.reduce({ type: 'ready', now: mono(), instanceId: idOf(instanceId), handshake });
    return true;
  }

  public started(instanceId?: string, resume?: { resumed?: boolean; current?: boolean }): void {
    if (!this.local) {
      this.reduce({ type: 'started', now: mono(), instanceId: idOf(instanceId), ...resume });
    }
  }

  public handshakeFailed(message: string, instanceId?: string): void {
    if (!this.local) {
      this.reduce({ type: 'handshake-failed', now: mono(), instanceId: idOf(instanceId), message });
    }
  }

  private apply(decision: PlacementDecision, reason: string, fresh: boolean, inline: boolean): PlaceResult {
    const now = mono();
    switch (decision.host) {
      case 'master':
        if (this.local) {
          return 'local';
        }
        if (this.placement.phase !== 'idle') {
          this.reduce({ type: 'reset', now });
        }
        this.setLocal(true);
        if (!inline) {
          this.consumer.runLocal(decision.reason ? `${reason}, ${decision.reason}` : reason);
        }
        return 'local';
      case 'worker': {
        const { agentId } = decision;
        if (this.local) {
          // the local process exits before the worker starts the key
          this.setLocal(false);
          this.consumer
            .stopLocal(`moving to worker ${this.workerName(agentId)}`)
            .catch(() => {})
            .then(() => {
              if (this.wanted && !this.local && !this.detached) {
                this.placeOn(agentId, true, reason);
              }
            });
          return 'remote';
        }
        if (!fresh && this.placement.agentId === agentId && ON_WORKER.has(this.placement.phase) && this.placement.phase !== 'failed') {
          return 'remote';
        }
        this.placeOn(agentId, fresh, reason);
        return 'remote';
      }
      case 'wait-release':
        if (!(this.placement.phase === 'releasing' && this.placement.releaseSeq === decision.seq)) {
          this.reduce({ type: 'release', now, seq: decision.seq, agentId: decision.agentId });
        }
        return 'waiting';
      case 'wait-worker':
        if (this.local) {
          this.setLocal(false);
          this.consumer
            .stopLocal(`waiting for worker ${this.workerName(decision.agentId)}`)
            .catch(() => {})
            .then(() => this.reconsider(reason));
          return 'waiting';
        }
        // a failure on that worker stays shown until the assignment changes
        if (this.placement.phase === 'failed' && this.placement.agentId === decision.agentId) {
          return 'waiting';
        }
        this.reduce({ type: 'wait', now, agentId: decision.agentId, reason: decision.reason });
        return 'waiting';
    }
  }

  private placeOn(agentId: string, fresh: boolean, reason: string): void {
    const placed = this.manager()?.desire(this.capability, this.id, agentId, fresh);
    if (!placed) {
      // the worker side went away in between
      if (this.wanted && !this.detached) {
        this.reduce({ type: 'reset', now: mono() });
        this.setLocal(true);
        this.consumer.runLocal(reason);
      }
      return;
    }

    if (this.shown?.agentId !== agentId) {
      this.shown = undefined;
    }
    const now = mono();
    const startedWithin = this.capability === WorkerCapability.PluginHost ? STARTED_DEADLINE_MS.plugin : STARTED_DEADLINE_MS.camera;
    this.reduce({ type: 'place', now, agentId, gen: placed.gen, startedWithin });
    if (placed.held) {
      this.reduce({ type: 'held', now, reason: placed.held });
    }
  }

  private nextReport(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const done = (): void => {
        clearTimeout(timer);
        this.reportWaiters.delete(done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      this.reportWaiters.add(done);
    });
  }

  private reduce(event: PlacementEvent): void {
    const before = this.placement;
    const { state, effects } = reducePlacement(before, event);
    this.placement = state;
    for (const effect of effects) {
      this.onEffect(effect, before);
    }
    if (state !== before && this.placement === state) {
      this.consumer.changed(this.info);
    }
  }

  private onEffect(effect: PlacementEffect, before: Placement): void {
    const agentId = before.agentId ?? this.placement.agentId;
    const worker = agentId ? this.workerName(agentId) : 'the worker';

    switch (effect.type) {
      case 'handshake':
        this.consumer.handshake(effect.instanceId);
        break;
      case 'bind':
        if (effect.instanceId && this.placement.gen) {
          this.manager()?.bind(this.capability, this.id, this.placement.gen, effect.instanceId, effect.level);
        }
        break;
      case 'resume':
        this.consumer.resume(effect.instanceId);
        break;
      case 'lost':
        this.logger.warn(`${capitalize(this.label)} on worker ${worker}: ${effect.reason}`);
        this.consumer.lost(effect.reason);
        break;
      case 'regen':
        this.logger.warn(`${capitalize(this.label)} on worker ${worker}: ${effect.reason}, starting a new instance (attempt ${this.placement.attempts + 1})`);
        if (agentId) {
          this.placeOn(agentId, true, effect.reason);
        }
        break;
      case 'failover':
        if (effect.lost) {
          this.consumer.lost(effect.reason);
        }
        this.consumer.changed(this.info);
        this.reconsider(effect.reason);
        break;
      case 'failed':
        this.logger.warn(`${capitalize(this.label)} cannot run on worker ${worker}: ${effect.failure.message}`);
        // a crash loop waits for a retry, other failures move elsewhere
        if (effect.failure.kind !== 'crash-loop' && agentId) {
          this.manager()?.noteFailure(this.capability, this.id, agentId);
          this.consumer.changed(this.info);
          this.reconsider(`it failed on worker ${worker}`);
        }
        break;
      case 'released':
        this.consumer.changed(this.info);
        this.reconsider(`stopped on worker ${worker}`);
        break;
      case 'release-slow':
        if (effect.final) {
          this.logger.warn(`Worker ${worker} did not confirm the stop of ${this.label} yet, it starts elsewhere once the worker confirms`);
        } else {
          this.logger.log(`Stopping ${this.label} on worker ${worker} takes long`);
        }
        break;
    }
  }

  private setLocal(local: boolean): void {
    if (this.local !== local) {
      this.local = local;
      this.localSince = Date.now();
      this.consumer.changed(this.info);
    }
  }

  private workerName(agentId: string): string {
    return this.manager()?.nameOf(agentId) ?? agentId;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
