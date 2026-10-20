import { stay } from './reducer.js';
import { scaled } from './timing.js';

import type { ChildExit } from '../../utils/supervised-child.js';
import type { Step } from './reducer.js';

export const RESTART_BACKOFF_MS = [2000, 5000, 10_000, 30_000, 60_000].map(scaled);
export const PROVISION_BACKOFF_MS = [30_000, 60_000, 120_000, 300_000].map(scaled);
export const STABLE_AFTER_MS = scaled(120_000);
export const CRASH_LOOP_EXITS = 5;
export const CRASH_LOOP_WINDOW_MS = scaled(600_000);

export type WorkloadMode = 'legacy' | 'synced';

export type WorkloadPhase = 'absent' | 'provisioning' | 'spawning' | 'running' | 'stopped-pending' | 'backoff' | 'stopping' | 'failed';

export type WorkloadFailure = 'platform' | 'gated' | 'binary-missing' | 'install' | 'crash-loop';

export type ExitReason = 'requested' | 'master-stop?' | 'clean' | 'crashed';

type Retry = 'provision' | 'spawn';

export interface WorkloadState {
  phase: WorkloadPhase;
  token: number;
  provisions: boolean;
  retry: Retry;
  restarts: number;
  provisionFailures: number;
  shortExits: number[];
  failure?: WorkloadFailure;
}

export type WorkloadEvent =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'gone' }
  | { type: 'provisioned'; token: number }
  | { type: 'provision-failed'; token: number; failure?: WorkloadFailure }
  | { type: 'spawned'; token: number }
  | { type: 'spawn-failed'; token: number; at: number; mode: WorkloadMode }
  | { type: 'exited'; token: number; exit: ChildExit; at: number; mode: WorkloadMode }
  | { type: 'timer'; token: number }
  | { type: 'still-desired' };

export type WorkloadEffect =
  | { type: 'provision'; token: number }
  | { type: 'spawn'; token: number }
  | { type: 'schedule'; token: number; delayMs: number }
  | { type: 'cancel' }
  | { type: 'stop-process' }
  | { type: 'report'; reason: ExitReason | 'provision-failed' | 'spawn-failed'; exit?: ChildExit; delayMs?: number; crashLoop?: boolean; failure?: WorkloadFailure };

export function initialWorkload(provisions: boolean): WorkloadState {
  return { phase: 'absent', token: 0, provisions, retry: provisions ? 'provision' : 'spawn', restarts: 0, provisionFailures: 0, shortExits: [] };
}

export function reduceWorkload(state: WorkloadState, event: WorkloadEvent): Step<WorkloadState, WorkloadEffect> {
  switch (event.type) {
    case 'start':
      return start(state);
    case 'stop':
      return stop(state);
    case 'gone':
      return state.phase === 'stopping' ? stay({ ...state, phase: 'absent' }) : stay(state);
    case 'provisioned':
      if (state.phase !== 'provisioning' || event.token !== state.token) {
        return stay(state);
      }
      return attempt({ ...state, provisionFailures: 0 }, 'spawn');
    case 'provision-failed': {
      if (state.phase !== 'provisioning' || event.token !== state.token) {
        return stay(state);
      }
      if (event.failure) {
        return { state: { ...state, phase: 'failed', failure: event.failure }, effects: [{ type: 'report', reason: 'provision-failed', failure: event.failure }] };
      }
      const delayMs = pick(PROVISION_BACKOFF_MS, state.provisionFailures);
      return backoff({ ...state, provisionFailures: state.provisionFailures + 1 }, 'provision', delayMs, [{ type: 'report', reason: 'provision-failed', delayMs }]);
    }
    case 'spawned':
      if (state.phase !== 'spawning' || event.token !== state.token) {
        return stay(state);
      }
      return stay({ ...state, phase: 'running' });
    case 'spawn-failed':
      if (state.phase !== 'spawning' || event.token !== state.token) {
        return stay(state);
      }
      return crashed(state, 'spawn-failed', { code: null, signal: null, requested: false, uptimeMs: 0 }, event.at, event.mode);
    case 'exited':
      return exited(state, event);
    case 'timer':
      if (state.phase !== 'backoff' || event.token !== state.token) {
        return stay(state);
      }
      return attempt(state, state.retry);
    case 'still-desired': {
      if (state.phase !== 'stopped-pending') {
        return stay(state);
      }
      const delayMs = pick(RESTART_BACKOFF_MS, state.restarts);
      return backoff({ ...state, restarts: state.restarts + 1 }, 'spawn', delayMs, [{ type: 'report', reason: 'clean', delayMs }]);
    }
  }
}

function start(state: WorkloadState): Step<WorkloadState, WorkloadEffect> {
  if (state.phase !== 'absent' && state.phase !== 'failed' && state.phase !== 'backoff' && state.phase !== 'stopped-pending') {
    return stay(state);
  }

  const fresh: WorkloadState = { ...initialWorkload(state.provisions), token: state.token };
  const step = attempt(fresh, fresh.retry);
  return state.phase === 'backoff' ? { state: step.state, effects: [{ type: 'cancel' }, ...step.effects] } : step;
}

function stop(state: WorkloadState): Step<WorkloadState, WorkloadEffect> {
  const token = state.token + 1;
  switch (state.phase) {
    case 'provisioning':
    case 'spawning':
    case 'running':
      return { state: { ...state, phase: 'stopping', token }, effects: [{ type: 'cancel' }, { type: 'stop-process' }] };
    case 'backoff':
    case 'stopped-pending':
    case 'failed':
      return { state: { ...state, phase: 'absent', token, failure: undefined }, effects: [{ type: 'cancel' }] };
    default:
      return stay(state);
  }
}

function exited(state: WorkloadState, event: Extract<WorkloadEvent, { type: 'exited' }>): Step<WorkloadState, WorkloadEffect> {
  const { exit } = event;

  if (state.phase === 'stopping' || (state.phase === 'running' && event.token === state.token && exit.requested)) {
    return { state: { ...state, phase: 'absent' }, effects: [{ type: 'report', reason: 'requested', exit }] };
  }
  if (state.phase !== 'running' || event.token !== state.token) {
    return stay(state);
  }
  // an older master stops a plugin over its channel, its next answer tells if it did
  if (event.mode === 'legacy' && exit.code === 0) {
    return { state: { ...state, phase: 'stopped-pending' }, effects: [{ type: 'report', reason: 'master-stop?', exit }] };
  }
  return crashed(state, exit.code === 0 && !exit.signal ? 'clean' : 'crashed', exit, event.at, event.mode);
}

function crashed(
  state: WorkloadState,
  reason: 'clean' | 'crashed' | 'spawn-failed',
  exit: ChildExit,
  at: number,
  mode: WorkloadMode,
): Step<WorkloadState, WorkloadEffect> {
  const stable = exit.uptimeMs >= STABLE_AFTER_MS;
  const restarts = stable ? 0 : state.restarts;
  const shortExits = [...state.shortExits.filter((t) => at - t < CRASH_LOOP_WINDOW_MS), ...(stable ? [] : [at])];
  const crashLoop = shortExits.length >= CRASH_LOOP_EXITS;

  if (crashLoop && mode === 'synced') {
    return {
      state: { ...state, phase: 'failed', failure: 'crash-loop', restarts, shortExits },
      effects: [{ type: 'report', reason, exit, crashLoop, failure: 'crash-loop' }],
    };
  }

  // a legacy master never asks again, keep trying at the slowest pace
  const delayMs = crashLoop ? RESTART_BACKOFF_MS[RESTART_BACKOFF_MS.length - 1] : pick(RESTART_BACKOFF_MS, restarts);
  // python provisions inside the spawn
  const retry: Retry = reason === 'spawn-failed' && state.provisions ? 'provision' : 'spawn';
  return backoff({ ...state, restarts: restarts + 1, shortExits }, retry, delayMs, [{ type: 'report', reason, exit, delayMs, crashLoop }]);
}

function attempt(state: WorkloadState, kind: Retry): Step<WorkloadState, WorkloadEffect> {
  const token = state.token + 1;
  return {
    state: { ...state, phase: kind === 'provision' ? 'provisioning' : 'spawning', token, retry: kind, failure: undefined },
    effects: [{ type: kind, token }],
  };
}

function backoff(state: WorkloadState, retry: Retry, delayMs: number, reports: WorkloadEffect[]): Step<WorkloadState, WorkloadEffect> {
  const token = state.token + 1;
  return { state: { ...state, phase: 'backoff', token, retry }, effects: [...reports, { type: 'schedule', token, delayMs }] };
}

function pick(values: number[], index: number): number {
  return values[Math.min(index, values.length - 1)];
}
