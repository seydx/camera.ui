import type { StopReason, WorkloadStatus } from '../lifecycle/managed-workload.js';
import type { CapabilitySpec, PluginInstallReport, WorkerCapability, WorkerProcessRef, WorkloadLive } from '../types.js';

export interface HostedStatus extends WorkloadStatus {
  version?: string;
  linked?: boolean;
  install?: PluginInstallReport;
}

export interface CapabilityHandler<C extends WorkerCapability = WorkerCapability> {
  readonly capability: C;
  start(id: string, spec: CapabilitySpec[C], live?: WorkloadLive): Promise<void>;
  stop(id: string, reason?: StopReason, budgetMs?: number): Promise<HostedStatus | undefined>;
  stopAll(reason?: StopReason, budgetMs?: number): Promise<Map<string, HostedStatus>>;
  close(): Promise<void>;
  stillDesired(id: string): void;
  setLive(id: string, live: WorkloadLive | undefined): void;
  status(id: string): HostedStatus | undefined;
  getActiveWorkIds(): string[];
  getActiveProcesses(): WorkerProcessRef[];
}

export async function stopEach(ids: Iterable<string>, stop: (id: string) => Promise<HostedStatus | undefined>): Promise<Map<string, HostedStatus>> {
  const stopped = new Map<string, HostedStatus>();
  await Promise.allSettled(
    Array.from(ids, async (id) => {
      const status = await stop(id);
      if (status) {
        stopped.set(id, status);
      }
    }),
  );
  return stopped;
}
