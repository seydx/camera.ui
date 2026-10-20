import { DESKTOP_UPDATE_RESTART_MS, UPDATE_RESTART_WINDOW_MS } from './lifecycle/timing.js';
import { describeUpdatePhase, reduceUpdate, startUpdate } from './lifecycle/update.js';

import type { Logger } from '@camera.ui/common/logger';
import type { WorkersService } from '../api/services/workers.service.js';
import type { WorkerUpdate, WorkerUpdateEffect, WorkerUpdateEvent, WorkerUpdateReport } from './lifecycle/update.js';
import type { WorkerUpdateState } from './types.js';

export interface WorkerUpdateResult {
  agentId: string;
  target: string;
  ok: boolean;
  version?: string;
  reason?: string;
}

export class WorkerUpdates {
  private items = new Map<string, WorkerUpdate>();
  private results = new Map<string, WorkerUpdateResult>();
  private reported = new Map<string, WorkerUpdateState>();
  private waiters = new Map<string, ((result: WorkerUpdateResult) => void)[]>();

  constructor(
    private workersService: WorkersService,
    private logger: Logger,
    private nameOf: (agentId: string) => string,
    private onResult: (result: WorkerUpdateResult) => void,
  ) {}

  public load(): { agentId: string; target: string }[] {
    const now = Date.now();
    const resumed: { agentId: string; target: string }[] = [];
    for (const [agentId, item] of Object.entries(this.workersService.getUpdates())) {
      const { state } = reduceUpdate(item, { type: 'resumed', now });
      if (!state) continue;
      this.items.set(agentId, state);
      resumed.push({ agentId, target: state.target });
      this.logger.log(`Worker ${this.nameOf(agentId)} was updating to ${item.target} when this server stopped, waiting for the result`);
    }
    return resumed;
  }

  public active(agentId: string): boolean {
    return this.items.has(agentId);
  }

  public activeIds(): string[] {
    return Array.from(this.items.keys());
  }

  public holdMs(agentId: string): number {
    const item = this.items.get(agentId);
    if (!item) return 0;
    return item.desktop && item.phase === 'restarting' ? DESKTOP_UPDATE_RESTART_MS : UPDATE_RESTART_WINDOW_MS;
  }

  public start(agentId: string, target: string, from: WorkerUpdateReport, desktop: boolean, legacy = false): void {
    const item = startUpdate(target, Date.now(), { ...from, update: this.reported.get(agentId) }, desktop, legacy);
    this.items.set(agentId, item);
    this.results.delete(agentId);
    this.persist(agentId, item);
  }

  public report(agentId: string, report: WorkerUpdateReport): void {
    if (report.update) {
      this.reported.set(agentId, report.update);
    }
    this.apply(agentId, { type: 'report', now: Date.now(), ...report });
  }

  public assume(agentId: string, update: WorkerUpdateState | undefined): void {
    if (update) {
      this.reported.set(agentId, update);
    } else {
      this.reported.delete(agentId);
    }
  }

  public restarting(agentId: string): void {
    this.apply(agentId, { type: 'restarting', now: Date.now() });
  }

  public tick(): void {
    const now = Date.now();
    for (const agentId of Array.from(this.items.keys())) {
      this.apply(agentId, { type: 'tick', now });
    }
  }

  public abort(agentId: string, reason: string): void {
    const item = this.items.get(agentId);
    this.items.delete(agentId);
    this.reported.delete(agentId);
    if (item) {
      this.finish(agentId, item.target, { type: 'failed', reason });
    }
    this.results.delete(agentId);
  }

  public state(agentId: string): WorkerUpdateState | undefined {
    const reported = this.reported.get(agentId);
    const item = this.items.get(agentId);
    const result = this.results.get(agentId);
    if (!reported && !item) return undefined;

    const base: WorkerUpdateState = { updatable: reported?.updatable ?? false, updating: false, desktop: reported?.desktop, lastResult: reported?.lastResult };
    if (item) {
      return { ...base, updating: true, phase: describeUpdatePhase(item), target: item.target };
    }
    if (result) {
      return result.ok ? base : { ...base, error: result.reason, phase: 'failed', target: result.target };
    }
    return { ...base, error: reported?.error };
  }

  public wait(agentId: string): Promise<WorkerUpdateResult> {
    const result = this.results.get(agentId);
    if (!this.items.has(agentId)) {
      return Promise.resolve(result ?? { agentId, target: '', ok: false, reason: 'no update is running on this worker' });
    }
    return new Promise((resolve) => this.waiters.set(agentId, [...(this.waiters.get(agentId) ?? []), resolve]));
  }

  private apply(agentId: string, event: WorkerUpdateEvent): void {
    const item = this.items.get(agentId);
    if (!item) return;

    const { state, effects } = reduceUpdate(item, event);
    if (state) {
      this.items.set(agentId, state);
    } else {
      this.items.delete(agentId);
    }

    for (const effect of effects) {
      if (effect.type === 'changed') {
        this.persist(agentId, state);
      } else {
        this.finish(agentId, item.target, effect);
      }
    }
  }

  private finish(agentId: string, target: string, effect: Exclude<WorkerUpdateEffect, { type: 'changed' }>): void {
    this.persist(agentId, undefined);
    const result: WorkerUpdateResult =
      effect.type === 'done' ? { agentId, target, ok: true, version: effect.version } : { agentId, target, ok: false, reason: effect.reason };
    this.results.set(agentId, result);

    if (result.ok) {
      this.logger.log(`Worker ${this.nameOf(agentId)} is updated, it runs ${result.version ?? target}`);
    } else {
      this.logger.warn(`Worker ${this.nameOf(agentId)} did not update to ${target}: ${result.reason}`);
    }

    const waiters = this.waiters.get(agentId) ?? [];
    this.waiters.delete(agentId);
    for (const resolve of waiters) resolve(result);
    this.onResult(result);
  }

  private persist(agentId: string, item: WorkerUpdate | undefined): void {
    this.workersService.saveUpdate(agentId, item).catch((error) => this.logger.warn(`Could not store the update of worker ${this.nameOf(agentId)}: ${error.message}`));
  }
}
