import { killTree } from '@camera.ui/common/node';

import { inject } from '../container.js';
import { childStopBudget } from '../shutdown-state.js';
import { HOST_PROTOCOL, HOST_PROTOCOL_ENV, INSTANCE_ID_ENV, STOP_BUDGET_ENV } from './host-protocol.js';
import { nextInstanceId } from './instance-id.js';

import type { ChildProcess } from 'node:child_process';
import type { ConfigService } from '../services/config/index.js';

export const PLUGIN_STOP_BUDGET_MS = 8000;
export const DECODER_STOP_BUDGET_MS = 2000;
export const KILL_MARGIN_MS = 1000;

const POSIX = process.platform !== 'win32';

export type ChildRole = 'plugin' | 'frame';

export interface ChildExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  requested: boolean;
  uptimeMs: number;
}

export interface SupervisedSpawn {
  instanceId: string;
  stopBudgetMs: number;
  signalStop: boolean;
  detached: boolean;
  windowsHide: true;
  env: Record<string, string>;
}

export interface SupervisedChildInfo {
  role: ChildRole;
  command: string;
  args: string[];
  titles?: string[];
}

export class SupervisedChild {
  public readonly startedAt = Date.now();
  public readonly exited: Promise<ChildExit>;

  private stopRequested = false;
  private exitInfo?: ChildExit;
  private configService: ConfigService;
  private readonly role: ChildRole;

  constructor(
    public readonly child: ChildProcess,
    public readonly spawn: SupervisedSpawn,
    info: SupervisedChildInfo,
  ) {
    this.configService = inject('configService');
    this.role = info.role;
    // EPIPE when the child is gone would surface as an uncaught error
    child.stdin?.on('error', () => {});
    this.exited = new Promise((resolve) => {
      child.once('exit', (code, signal) => {
        this.exitInfo = { code, signal, requested: this.stopRequested, uptimeMs: Date.now() - this.startedAt };
        this.configService.removeProcessByPID(child.pid);
        // kill what outlived the leader, a pgid stays taken while the group has members
        if (POSIX && spawn.detached && child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            // the group is empty
          }
        }
        resolve(this.exitInfo);
      });
    });

    if (child.pid) {
      this.configService.addProcess({
        pid: child.pid,
        pgid: POSIX && spawn.detached ? child.pid : undefined,
        startTime: this.startedAt,
        command: info.command,
        args: info.args,
        titles: info.titles,
        role: info.role,
        instanceId: spawn.instanceId,
      });
    }
  }

  public get pid(): number | undefined {
    return this.child.pid;
  }

  public get instanceId(): string {
    return this.spawn.instanceId;
  }

  public get running(): boolean {
    return !this.exitInfo && this.child.pid !== undefined;
  }

  public get requested(): boolean {
    return this.stopRequested;
  }

  public async stop(budgetMs = childStopBudget(this.spawn.stopBudgetMs)): Promise<ChildExit | undefined> {
    this.stopRequested = true;
    if (!this.running) {
      return this.exitInfo;
    }

    try {
      this.child.stdin?.end(`${JSON.stringify({ stop: { budgetMs } })}\n`);
    } catch {
      // the child closed its end already
    }

    if (POSIX && this.spawn.signalStop) {
      this.child.kill('SIGTERM');
    }

    let timer: NodeJS.Timeout | undefined;
    const killed = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        // taskkill takes seconds on windows, the margin starts once it returned
        this.terminate().finally(() => setTimeout(resolve, KILL_MARGIN_MS).unref());
      }, budgetMs + KILL_MARGIN_MS);
    });

    try {
      await Promise.race([this.exited, killed]);
    } finally {
      clearTimeout(timer);
    }
    return this.exitInfo;
  }

  public kill(): void {
    this.terminate();
  }

  private async terminate(): Promise<void> {
    this.stopRequested = true;
    if (!this.child.pid || this.exitInfo) {
      return;
    }
    // a decoder starts no processes of its own, and taskkill /T takes seconds on windows
    if (!POSIX && this.role === 'frame') {
      this.child.kill();
      return;
    }
    await killTree({ pid: this.child.pid, pgid: POSIX && this.spawn.detached ? this.child.pid : undefined }).catch(() => {});
  }
}

export function supervisedSpawn(stopBudgetMs: number, options: { signalStop?: boolean; env?: Record<string, string>; instanceId?: string } = {}): SupervisedSpawn {
  const instanceId = options.instanceId ?? nextInstanceId();
  return {
    instanceId,
    stopBudgetMs,
    signalStop: options.signalStop ?? false,
    detached: POSIX,
    windowsHide: true,
    env: {
      ...options.env,
      [HOST_PROTOCOL_ENV]: String(HOST_PROTOCOL),
      [INSTANCE_ID_ENV]: instanceId,
      [STOP_BUDGET_ENV]: String(stopBudgetMs),
    },
  };
}
