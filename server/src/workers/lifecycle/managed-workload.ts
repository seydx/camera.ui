import { nextInstanceId } from '../../utils/instance-id.js';
import { exitInfo } from '../../utils/process-exit.js';
import { initialWorkload, reduceWorkload } from './workload.js';

import type { Logger } from '@camera.ui/common/logger';
import type { ChildExit } from '../../utils/supervised-child.js';
import type { FailureKind, WorkloadPhase as ReportedPhase, WorkloadExit } from '../types.js';
import type { WorkloadEffect, WorkloadEvent, WorkloadFailure, WorkloadMode, WorkloadPhase, WorkloadState } from './workload.js';

export interface WorkloadProcess {
  readonly pid: number | undefined;
  readonly exited: Promise<ChildExit>;
  stop(budgetMs?: number): Promise<unknown>;
}

export interface WorkloadDriver {
  readonly label: string;
  readonly provisions: boolean;
  provision(signal: AbortSignal): Promise<void>;
  spawn(signal: AbortSignal, instanceId: string): Promise<WorkloadProcess>;
}

export interface WorkloadHooks {
  onChange?(): void;
  beforeSpawn?(instanceId: string): Promise<void>;
}

export interface WorkloadStatus {
  phase: ReportedPhase;
  since: number;
  instanceId?: string;
  pid?: number;
  restarts: number;
  nextRestartAt?: number;
  lastExit?: WorkloadExit;
  failure?: { kind: FailureKind; message: string; terminal: boolean };
}

export type StopReason = 'requested' | 'lease';

export class ProvisionError extends Error {
  constructor(
    message: string,
    public readonly failure: WorkloadFailure,
  ) {
    super(message);
  }
}

export class ManagedWorkload {
  private state: WorkloadState;
  private process?: WorkloadProcess;
  private timer?: NodeJS.Timeout;
  private abort?: AbortController;
  private inflight = new Set<Promise<unknown>>();
  private lastError?: string;
  private instance?: string;
  private since = Date.now();
  private nextRestartAt?: number;
  private lastExit?: WorkloadExit;
  private failureReport?: WorkloadStatus['failure'];
  private stopReason: StopReason = 'requested';

  constructor(
    private driver: WorkloadDriver,
    private logger: Logger,
    private mode: () => WorkloadMode,
    private hooks: WorkloadHooks = {},
  ) {
    this.state = initialWorkload(driver.provisions);
  }

  public get phase(): WorkloadPhase {
    return this.state.phase;
  }

  public get failure(): WorkloadFailure | undefined {
    return this.state.failure;
  }

  public get pid(): number | undefined {
    return this.process?.pid;
  }

  public get instanceId(): string | undefined {
    return this.instance;
  }

  public get status(): WorkloadStatus {
    return {
      phase: reportedPhase(this.state.phase),
      since: this.since,
      instanceId: this.instance,
      pid: this.process?.pid,
      restarts: this.state.restarts,
      nextRestartAt: this.state.phase === 'backoff' ? this.nextRestartAt : undefined,
      lastExit: this.lastExit,
      failure: this.state.phase === 'failed' || this.state.phase === 'backoff' ? this.failureReport : undefined,
    };
  }

  public start(): void {
    this.dispatch({ type: 'start' });
  }

  public stillDesired(): void {
    this.dispatch({ type: 'still-desired' });
  }

  public async stop(reason: StopReason = 'requested', budgetMs?: number): Promise<void> {
    this.stopReason = reason;
    this.dispatch({ type: 'stop' }, budgetMs);
    while (this.inflight.size > 0) {
      await Promise.allSettled([...this.inflight]);
    }
    this.process = undefined;
    this.dispatch({ type: 'gone' });
  }

  private dispatch(event: WorkloadEvent, budgetMs?: number): void {
    const before = this.state.phase;
    const { state, effects } = reduceWorkload(this.state, event);
    this.state = state;
    if (state.phase !== before) {
      this.since = Date.now();
    }
    for (const effect of effects) {
      this.run(effect, budgetMs);
    }
    if (state.phase !== before) {
      this.hooks.onChange?.();
    }
  }

  private run(effect: WorkloadEffect, budgetMs?: number): void {
    switch (effect.type) {
      case 'provision':
        this.track(this.provision(effect.token));
        break;
      case 'spawn':
        this.track(this.spawn(effect.token));
        break;
      case 'schedule':
        clearTimeout(this.timer);
        this.nextRestartAt = Date.now() + effect.delayMs;
        this.timer = setTimeout(() => this.dispatch({ type: 'timer', token: effect.token }), effect.delayMs);
        break;
      case 'cancel':
        clearTimeout(this.timer);
        this.timer = undefined;
        this.nextRestartAt = undefined;
        this.abort?.abort();
        break;
      case 'stop-process':
        if (this.process) {
          this.track(this.process.stop(budgetMs));
        }
        break;
      case 'report':
        this.record(effect);
        this.log(effect);
        break;
    }
  }

  private async provision(token: number): Promise<void> {
    this.abort = new AbortController();
    try {
      await this.driver.provision(this.abort.signal);
    } catch (error) {
      if (token === this.state.token) {
        this.lastError = errorMessage(error);
        this.dispatch({ type: 'provision-failed', token, failure: error instanceof ProvisionError ? error.failure : undefined });
      }
      return;
    }
    this.dispatch({ type: 'provisioned', token });
  }

  private async spawn(token: number): Promise<void> {
    const abort = new AbortController();
    this.abort = abort;

    const instanceId = nextInstanceId();
    this.instance = instanceId;
    this.hooks.onChange?.();
    await this.hooks.beforeSpawn?.(instanceId);

    let child: WorkloadProcess;
    try {
      abort.signal.throwIfAborted();
      child = await this.driver.spawn(abort.signal, instanceId);
    } catch (error) {
      if (token === this.state.token) {
        this.lastError = errorMessage(error);
        this.dispatch({ type: 'spawn-failed', token, at: Date.now(), mode: this.mode() });
      }
      if (this.instance === instanceId) {
        this.instance = undefined;
      }
      return;
    }

    if (token !== this.state.token) {
      await child.stop();
      if (this.instance === instanceId) {
        this.instance = undefined;
      }
      return;
    }

    this.process = child;
    child.exited.then((exit) => {
      if (this.process === child) {
        this.process = undefined;
      }
      if (this.instance === instanceId) {
        this.instance = undefined;
      }
      this.lastExit = {
        instanceId,
        code: exit.code,
        signal: exit.signal,
        at: Date.now(),
        uptimeMs: exit.uptimeMs,
        reason: exit.requested ? this.stopReason : exit.code === 0 && !exit.signal ? 'clean' : 'crashed',
      };
      this.dispatch({ type: 'exited', token, exit, at: Date.now(), mode: this.mode() });
      this.hooks.onChange?.();
    });
    this.dispatch({ type: 'spawned', token });
  }

  private track(work: Promise<unknown>): void {
    const tracked = work.catch((error) => this.logger.error(`${this.driver.label}: ${errorMessage(error)}`)).finally(() => this.inflight.delete(tracked));
    this.inflight.add(tracked);
  }

  private record(effect: Extract<WorkloadEffect, { type: 'report' }>): void {
    if (effect.reason === 'master-stop?' && this.lastExit) {
      this.lastExit = { ...this.lastExit, reason: 'master-stop' };
    }

    if (effect.failure) {
      this.failureReport = { kind: effect.failure, message: this.lastError ?? effect.failure, terminal: true };
    } else if (effect.reason === 'provision-failed') {
      this.failureReport = { kind: 'install', message: this.lastError ?? 'install failed', terminal: false };
    } else {
      this.failureReport = undefined;
    }
  }

  private log(effect: Extract<WorkloadEffect, { type: 'report' }>): void {
    const { label } = this.driver;
    const details = effect.exit ? exitInfo(effect.exit.code, effect.exit.signal) : '';
    const retry = effect.delayMs !== undefined ? `, restart in ${effect.delayMs / 1000} s` : '';

    if (effect.failure === 'crash-loop') {
      this.logger.error(`${label} crashed ${this.state.shortExits.length} times in 10 min, waiting for the master to ask again`);
      return;
    }

    switch (effect.reason) {
      case 'requested':
        this.logger.log(`${label} exited (${details})`);
        break;
      case 'master-stop?':
        this.logger.log(`${label} exited with code 0 without a request, waiting for the next answer of the master`);
        break;
      case 'clean':
        this.logger.warn(`${label} exited with code 0 without a request${retry}`);
        break;
      case 'crashed':
        this.logger.error(`${label} crashed (${details})${effect.crashLoop ? ', it keeps crashing' : ''}${retry}`);
        break;
      case 'spawn-failed':
        this.logger.error(`${label} did not start: ${this.lastError}${retry}`);
        break;
      case 'provision-failed':
        if (effect.failure) {
          this.logger.error(`${label} cannot run on this worker: ${this.lastError}`);
        } else {
          this.logger.error(`${label} could not be installed: ${this.lastError}, retry in ${(effect.delayMs ?? 0) / 1000} s`);
        }
        break;
    }
  }
}

function reportedPhase(phase: WorkloadPhase): ReportedPhase {
  switch (phase) {
    case 'absent':
    case 'stopped-pending':
      return 'stopped';
    default:
      return phase;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
