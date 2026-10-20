import { isEqual } from '@camera.ui/common/utils';

import { workloadKey } from '../types.js';

import type { Logger } from '@camera.ui/common/logger';
import type { CapabilityHandler } from '../capabilities/handler.js';
import type { WorkerCapability, WorkloadBinding, WorkloadPhase, WorkloadSpec } from '../types.js';

const PARALLEL_STOPS = 4;

export interface DesiredState {
  workloads: WorkloadSpec[];
  holds?: string[];
  seq?: number;
  runId?: string;
}

export interface AppliedView {
  spec: unknown;
  revision: number;
  gen?: string;
  phase?: WorkloadPhase;
  instanceId?: string;
  bound?: WorkloadBinding;
}

export type Decision = 'start' | 'keep' | 'adopt' | 'restart';

export function decide(applied: AppliedView | undefined, desired: WorkloadSpec): Decision {
  if (!applied) {
    return 'start';
  }
  if (!isEqual(applied.spec, desired.spec)) {
    return 'restart';
  }
  if (desired.gen === undefined) {
    return applied.revision === desired.revision ? 'keep' : 'restart';
  }
  if (desired.gen === applied.gen) {
    return 'keep';
  }
  if (desired.adopt && applied.phase === 'running' && applied.bound?.handshake === 2 && applied.bound.instanceId === applied.instanceId) {
    return 'adopt';
  }
  return 'restart';
}

interface Applied {
  workload: WorkloadSpec;
  bound?: WorkloadBinding;
  stale?: boolean;
}

export class Reconciler {
  private applied = new Map<string, Applied>();
  private pending?: DesiredState;
  private running?: Promise<void>;
  private paused = false;
  private closed = false;

  constructor(
    private handlers: Map<WorkerCapability, CapabilityHandler>,
    private logger: Logger,
    private onApplied: (desired: DesiredState) => void = () => {},
  ) {}

  public get size(): number {
    return this.applied.size;
  }

  public gen(key: string): string | undefined {
    return this.applied.get(key)?.workload.gen;
  }

  public revision(key: string): number | undefined {
    return this.applied.get(key)?.workload.revision;
  }

  public binding(key: string): WorkloadBinding | undefined {
    return this.applied.get(key)?.bound;
  }

  public invalidate(): void {
    for (const applied of this.applied.values()) {
      applied.stale = true;
    }
  }

  public submit(desired: DesiredState): void {
    if (this.closed) {
      return;
    }
    this.pending = desired;
    this.drainSoon();
  }

  public async reset(stop: () => Promise<void>): Promise<void> {
    this.paused = true;
    this.pending = undefined;
    try {
      await this.running;
      await stop();
      this.applied.clear();
    } finally {
      this.paused = false;
      this.drainSoon();
    }
  }

  public async close(): Promise<void> {
    this.closed = true;
    this.pending = undefined;
    await this.running;
  }

  private drainSoon(): void {
    if (!this.paused && this.pending) {
      this.running ??= this.drain().finally(() => (this.running = undefined));
    }
  }

  private async drain(): Promise<void> {
    while (this.pending && !this.closed && !this.paused) {
      const desired = this.pending;
      this.pending = undefined;
      await this.pass(desired);
    }
  }

  private async pass(desired: DesiredState): Promise<void> {
    const wanted = new Map<string, WorkloadSpec>();
    for (const workload of desired.workloads) {
      if (this.handlers.has(workload.capability)) {
        wanted.set(workloadKey(workload.capability, workload.id), workload);
      }
    }
    const held = new Set(desired.holds ?? []);

    const stops: [string, WorkloadSpec][] = [];
    const starts: [string, WorkloadSpec][] = [];
    for (const [key, applied] of this.applied) {
      if (!wanted.has(key) && !held.has(key)) {
        stops.push([key, applied.workload]);
      }
    }
    for (const [key, workload] of wanted) {
      const applied = this.applied.get(key);
      const handler = this.handlers.get(workload.capability);
      const status = handler?.status(workload.id);
      const decision = applied?.stale
        ? 'restart'
        : decide(applied && { ...applied.workload, bound: applied.bound, phase: status?.phase, instanceId: status?.instanceId }, workload);

      if (decision === 'keep' || decision === 'adopt') {
        if (!isEqual(applied?.workload.live, workload.live)) {
          handler?.setLive(workload.id, workload.live);
        }
        const bound = workload.bound && workload.bound.instanceId === status?.instanceId ? workload.bound : applied?.bound;
        this.applied.set(key, { workload, bound });
        handler?.stillDesired(workload.id);
        continue;
      }
      if (decision === 'restart' && applied) {
        stops.push([key, applied.workload]);
      }
      starts.push([key, workload]);
    }

    // single owner beats a gap, every stop ends before any start
    await withLimit(stops, PARALLEL_STOPS, async ([key, workload]) => {
      try {
        await this.handlers.get(workload.capability)?.stop(workload.id);
        this.applied.delete(key);
      } catch (error) {
        this.logger.error(`Failed to stop workload ${key}: ${error instanceof Error ? error.message : error}`);
      }
    });

    if (this.closed || this.paused) {
      return;
    }

    await Promise.all(
      starts.map(async ([key, workload]) => {
        // set first, the spawning report goes out before start() returns
        this.applied.set(key, { workload });
        try {
          await this.handlers.get(workload.capability)?.start(workload.id, workload.spec, workload.live);
        } catch (error) {
          this.applied.delete(key);
          this.logger.error(`Failed to start workload ${key}: ${error instanceof Error ? error.message : error}`);
        }
      }),
    );

    if (!this.closed && !this.paused) {
      this.onApplied(desired);
    }
  }
}

async function withLimit<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      await work(items[next++]);
    }
  });
  await Promise.all(lanes);
}
