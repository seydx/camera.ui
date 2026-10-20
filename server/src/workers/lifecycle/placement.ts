import { stay } from './reducer.js';
import {
  INITIALIZE_BACKOFF_MS,
  INSTALL_CAP_MS,
  NO_PROGRESS_MS,
  READY_BUFFER_MS,
  READY_DEADLINE_MS,
  RELEASE_ACK_FAIL_MS,
  RELEASE_ACK_WARN_MS,
  RESUME_INTERVAL_MS,
  RESUME_TIMEOUT_MS,
  SPAWNED_POKE_MS,
} from './timing.js';

import type { FailureKind, WorkloadReport } from '../types.js';
import type { Step } from './reducer.js';

export type RemotePhase =
  'idle' | 'pending' | 'provisioning' | 'spawned' | 'adopting' | 'handshaking' | 'bound' | 'restarting' | 'held' | 'releasing' | 'failed' | 'waiting-for-worker';

export type PlacementPhase = RemotePhase | 'local';

export interface PlacementFailure {
  kind: FailureKind;
  message: string;
  terminal: boolean;
}

export interface Placement {
  phase: RemotePhase;
  since: number;
  agentId?: string;
  gen?: string;
  reason?: string;
  reported?: string;
  handshake?: string;
  bound?: string;
  level?: 1 | 2;
  attempts: number;
  deadline?: number;
  retryAt?: number;
  pokeAt?: number;
  heldFrom?: RemotePhase;
  releaseSeq?: number;
  releaseWarned?: 0 | 1 | 2;
  startedWithin?: number;
  failure?: PlacementFailure;
  buffered?: { instanceId?: string; level: 1 | 2; until: number };
}

export type PlacementEvent =
  | { type: 'place'; now: number; agentId: string; gen: string; startedWithin?: number }
  | { type: 'report'; now: number; report?: WorkloadReport }
  | { type: 'ready'; now: number; instanceId?: string; handshake?: number }
  | { type: 'started'; now: number; instanceId?: string; resumed?: boolean; current?: boolean }
  | { type: 'handshake-failed'; now: number; instanceId?: string; message: string }
  | { type: 'held'; now: number; reason: string }
  | { type: 'resumed'; now: number }
  | { type: 'instances-gone'; now: number; reason: string }
  | { type: 'failover'; now: number; reason: string }
  | { type: 'release'; now: number; seq: number; agentId?: string }
  | { type: 'released'; now: number }
  | { type: 'wait'; now: number; agentId: string; reason: string }
  | { type: 'reset'; now: number }
  | { type: 'tick'; now: number };

export type PlacementEffect =
  | { type: 'handshake'; instanceId?: string }
  | { type: 'bind'; instanceId?: string; level: 1 | 2 }
  | { type: 'resume'; instanceId: string }
  | { type: 'lost'; reason: string }
  | { type: 'regen'; reason: string }
  | { type: 'failover'; reason: string; lost: boolean }
  | { type: 'failed'; failure: PlacementFailure }
  | { type: 'released' }
  | { type: 'release-slow'; final: boolean };

export function idlePlacement(now = 0): Placement {
  return { phase: 'idle', since: now, attempts: 0 };
}

const LIVE: ReadonlySet<RemotePhase> = new Set(['pending', 'provisioning', 'spawned', 'adopting', 'handshaking', 'bound', 'restarting']);

export function reducePlacement(placement: Placement, event: PlacementEvent): Step<Placement, PlacementEffect> {
  switch (event.type) {
    case 'place':
      return stay({
        ...enter(placement, 'pending', event.now),
        agentId: event.agentId,
        gen: event.gen,
        startedWithin: event.startedWithin,
        reported: undefined,
        handshake: undefined,
        bound: undefined,
        level: undefined,
        deadline: event.now + NO_PROGRESS_MS,
        retryAt: undefined,
        pokeAt: undefined,
        heldFrom: undefined,
        releaseSeq: undefined,
        failure: undefined,
        buffered: undefined,
      });
    case 'report':
      return LIVE.has(placement.phase) ? onReport(placement, event.report, event.now) : stay(placement);
    case 'ready':
      return onReady(placement, event.instanceId, levelOf(event.handshake), event.now);
    case 'started':
      return onStarted(placement, event);
    case 'handshake-failed': {
      const instance = placement.phase === 'adopting' ? placement.reported : placement.handshake;
      if ((placement.phase !== 'handshaking' && placement.phase !== 'adopting') || (event.instanceId && event.instanceId !== instance)) {
        return stay(placement);
      }
      return retryLater(placement, event.now, event.message);
    }
    case 'held':
      if (!LIVE.has(placement.phase)) {
        return stay(placement);
      }
      return stay({ ...enter(placement, 'held', event.now, event.reason), heldFrom: placement.phase });
    case 'resumed':
      if (placement.phase !== 'held') {
        return stay(placement);
      }
      return stay({
        ...enter(placement, placement.heldFrom ?? 'pending', event.now),
        heldFrom: undefined,
        deadline: deadlineFor(placement.heldFrom, placement, event.now),
        pokeAt: placement.heldFrom === 'adopting' ? event.now : placement.pokeAt,
      });
    case 'instances-gone':
      return instancesGone(placement, event.now, event.reason);
    case 'failover': {
      if (placement.phase === 'idle' || placement.phase === 'failed' || placement.phase === 'waiting-for-worker') {
        return stay(placement);
      }
      if (placement.phase === 'releasing') {
        return { state: idle(placement, event.now), effects: [{ type: 'released' }] };
      }
      const lost = placement.bound !== undefined;
      return { state: idle(placement, event.now), effects: [{ type: 'failover', reason: event.reason, lost }] };
    }
    case 'release':
      return stay({
        ...enter(placement, 'releasing', event.now),
        agentId: event.agentId ?? placement.agentId,
        releaseSeq: event.seq,
        releaseWarned: 0,
        deadline: event.now + RELEASE_ACK_WARN_MS,
        handshake: undefined,
        bound: undefined,
        buffered: undefined,
      });
    case 'released':
      return placement.phase === 'releasing' ? { state: idle(placement, event.now), effects: [{ type: 'released' }] } : stay(placement);
    case 'wait':
      return stay({ ...idle(placement, event.now), phase: 'waiting-for-worker', agentId: event.agentId, reason: event.reason });
    case 'reset':
      return stay(idle(placement, event.now));
    case 'tick':
      return tick(placement, event.now);
  }
}

function enter(placement: Placement, phase: RemotePhase, now: number, reason?: string): Placement {
  return placement.phase === phase && placement.reason === reason ? placement : { ...placement, phase, since: now, reason };
}

function idle(placement: Placement, now: number): Placement {
  return { ...idlePlacement(now), attempts: placement.attempts };
}

function deadlineFor(phase: RemotePhase | undefined, placement: Placement, now: number): number | undefined {
  switch (phase) {
    case 'pending':
      return now + NO_PROGRESS_MS;
    case 'spawned':
      return now + pick(READY_DEADLINE_MS, placement.attempts);
    case 'adopting':
      return now + RESUME_TIMEOUT_MS;
    default:
      return placement.deadline;
  }
}

function onReport(placement: Placement, report: WorkloadReport | undefined, now: number): Step<Placement, PlacementEffect> {
  // the agent has not taken this decision yet
  if (!report || report.gen !== placement.gen) {
    if (!report && placement.bound) {
      return lose(placement, now, 'stopped without a request');
    }
    return stay(placement);
  }

  if (report.phase === 'failed' && report.failure?.terminal) {
    const failure = { kind: report.failure.kind, message: report.failure.message, terminal: true };
    return {
      state: { ...enter(placement, 'failed', now, failure.message), failure, bound: undefined, handshake: undefined, deadline: undefined },
      effects: [{ type: 'failed', failure }],
    };
  }

  const instance = report.instanceId;
  if (placement.bound && placement.bound !== instance) {
    return relocate(lose(placement, now, exitReason(report)), report, now);
  }
  if (placement.bound) {
    return stay(placement);
  }

  return relocate({ state: placement, effects: [] }, report, now);
}

function relocate(step: Step<Placement, PlacementEffect>, report: WorkloadReport, now: number): Step<Placement, PlacementEffect> {
  const placement = step.state;
  const effects = [...step.effects];
  const instance = report.instanceId;

  switch (report.phase) {
    case 'provisioning': {
      const first = placement.phase !== 'provisioning';
      const step = report.install?.step === 'download' ? 'downloading' : report.install?.step === 'dependencies' ? 'installing dependencies' : 'installing';
      const reason = report.failure ? `install failed, retrying: ${report.failure.message}` : step;
      return { state: { ...enter(placement, 'provisioning', now, reason), deadline: first ? now + INSTALL_CAP_MS : placement.deadline }, effects };
    }
    case 'spawning':
    case 'running': {
      if (!instance) {
        return { state: placement, effects };
      }
      if (placement.phase === 'handshaking' && placement.handshake === instance) {
        return { state: placement, effects };
      }
      if (placement.phase === 'adopting' && placement.reported === instance) {
        return { state: placement, effects };
      }
      if (placement.phase === 'spawned' && placement.reported === instance) {
        // a running child that sent no READY may have lost it
        if (report.phase === 'running' && placement.pokeAt === undefined) {
          return { state: { ...placement, pokeAt: now + SPAWNED_POKE_MS }, effects };
        }
        return { state: placement, effects };
      }
      const buffered = placement.buffered;
      if (buffered && buffered.until > now && (buffered.instanceId === instance || !buffered.instanceId)) {
        const spawned = { ...enter(placement, 'spawned', now), reported: instance };
        return {
          state: { ...handshaking(spawned, instance, now), level: buffered.level, buffered: undefined },
          effects: [...effects, { type: 'handshake', instanceId: instance }],
        };
      }
      // a kept instance that a previous master already finished the re-handshake with
      if (report.phase === 'running' && report.handshake === 2) {
        return {
          state: {
            ...enter(placement, 'adopting', now, 'reconnecting to the running instance'),
            reported: instance,
            handshake: undefined,
            level: 2,
            deadline: now + RESUME_TIMEOUT_MS,
            pokeAt: now + RESUME_INTERVAL_MS,
          },
          effects: [...effects, { type: 'resume', instanceId: instance }],
        };
      }
      const spawned: Placement = {
        ...enter(placement, 'spawned', now),
        reported: instance,
        handshake: undefined,
        level: undefined,
        deadline: now + pick(READY_DEADLINE_MS, placement.attempts),
        pokeAt: report.phase === 'running' ? now + SPAWNED_POKE_MS : undefined,
      };
      return { state: spawned, effects };
    }
    case 'backoff':
    case 'stopping':
    case 'stopped':
    case 'failed': {
      const reason = report.nextRestartAt ? `restart ${report.restarts + 1} on the worker` : exitReason(report);
      return { state: { ...enter(placement, 'restarting', now, reason), reported: undefined, handshake: undefined, deadline: undefined }, effects };
    }
  }
}

function onReady(placement: Placement, id: string | undefined, level: 1 | 2, now: number): Step<Placement, PlacementEffect> {
  const spawnedReady = placement.phase === 'spawned' && (id === placement.reported || (!id && !placement.bound));
  // READY{resume} of the kept instance, it reattaches with the next START
  const resumed = placement.phase === 'adopting' && id === placement.reported;
  if (placement.reported && (spawnedReady || resumed)) {
    return {
      state: { ...handshaking(placement, placement.reported, now), level, buffered: undefined },
      effects: [{ type: 'handshake', instanceId: placement.reported }],
    };
  }
  if (placement.phase === 'handshaking' && (!id || id === placement.handshake)) {
    return stay(placement);
  }
  if (LIVE.has(placement.phase) || placement.phase === 'held') {
    return stay({ ...placement, buffered: { instanceId: id, level, until: now + READY_BUFFER_MS } });
  }
  return stay(placement);
}

function onStarted(placement: Placement, event: Extract<PlacementEvent, { type: 'started' }>): Step<Placement, PlacementEffect> {
  if (event.current === false) {
    return stay(placement);
  }
  // the kept instance is attached to this run already, its READY got lost
  if (placement.phase === 'adopting' && event.resumed && placement.reported && event.instanceId === placement.reported) {
    return bind(placement, placement.reported, event.now);
  }
  if (placement.phase !== 'handshaking' || (event.instanceId && event.instanceId !== placement.handshake)) {
    return stay(placement);
  }
  return bind(placement, placement.handshake ?? event.instanceId, event.now);
}

function bind(placement: Placement, instanceId: string | undefined, now: number): Step<Placement, PlacementEffect> {
  return {
    state: { ...enter(placement, 'bound', now), bound: instanceId, deadline: undefined, pokeAt: undefined, attempts: 0 },
    effects: [{ type: 'bind', instanceId, level: placement.level ?? 1 }],
  };
}

function handshaking(placement: Placement, instanceId: string, now: number): Placement {
  return {
    ...enter(placement, 'handshaking', now),
    handshake: instanceId,
    pokeAt: undefined,
    deadline: placement.startedWithin === undefined ? undefined : now + placement.startedWithin,
  };
}

function lose(placement: Placement, now: number, reason: string): Step<Placement, PlacementEffect> {
  return {
    state: { ...enter(placement, 'restarting', now, reason), bound: undefined, handshake: undefined, reported: undefined, deadline: undefined },
    effects: [{ type: 'lost', reason }],
  };
}

function instancesGone(placement: Placement, now: number, reason: string): Step<Placement, PlacementEffect> {
  if (placement.phase === 'releasing') {
    return { state: idle(placement, now), effects: [{ type: 'released' }] };
  }
  const phase = placement.phase === 'held' ? placement.heldFrom : placement.phase;
  if (!phase || !LIVE.has(phase)) {
    return stay(placement);
  }
  // the next answer lists the key again, the worker starts it fresh
  const effects: PlacementEffect[] = placement.bound ? [{ type: 'lost', reason }] : [];
  const gone = { bound: undefined, handshake: undefined, reported: undefined, level: undefined, pokeAt: undefined };
  // a held worker is still away, the deadline starts once it is back
  if (placement.phase === 'held') {
    return { state: { ...placement, ...gone, heldFrom: 'pending', deadline: undefined }, effects };
  }
  return {
    state: { ...enter(placement, 'pending', now, reason), ...gone, heldFrom: undefined, deadline: now + NO_PROGRESS_MS },
    effects,
  };
}

function retryLater(placement: Placement, now: number, reason: string): Step<Placement, PlacementEffect> {
  const retryAt = now + pick(INITIALIZE_BACKOFF_MS, placement.attempts);
  return stay({
    ...enter(placement, 'restarting', now, reason),
    attempts: placement.attempts + 1,
    handshake: undefined,
    reported: undefined,
    deadline: undefined,
    retryAt,
  });
}

function tick(placement: Placement, now: number): Step<Placement, PlacementEffect> {
  let next = placement;
  if (next.buffered && next.buffered.until <= now) {
    next = { ...next, buffered: undefined };
  }

  if (next.phase === 'held') {
    return stay(next);
  }

  const step = expire(next, now);
  const after = step.state;
  if ((after.phase === 'spawned' || after.phase === 'adopting') && after.reported && after.pokeAt !== undefined && now >= after.pokeAt) {
    return { state: { ...after, pokeAt: now + RESUME_INTERVAL_MS }, effects: [...step.effects, { type: 'resume', instanceId: after.reported }] };
  }
  return step;
}

function expire(next: Placement, now: number): Step<Placement, PlacementEffect> {
  if (next.retryAt !== undefined && now >= next.retryAt) {
    return { state: { ...next, retryAt: undefined }, effects: [{ type: 'regen', reason: next.reason ?? 'retry' }] };
  }

  if (next.deadline === undefined || now < next.deadline) {
    return stay(next);
  }

  switch (next.phase) {
    case 'pending': {
      const failure: PlacementFailure = { kind: 'capability', message: 'the worker did not take the work', terminal: true };
      return { state: { ...enter(next, 'failed', now, failure.message), failure, deadline: undefined }, effects: [{ type: 'failed', failure }] };
    }
    case 'provisioning': {
      const failure: PlacementFailure = { kind: 'install', message: 'the install did not finish in time', terminal: true };
      return { state: { ...enter(next, 'failed', now, failure.message), failure, deadline: undefined }, effects: [{ type: 'failed', failure }] };
    }
    case 'spawned': {
      // a lost READY costs one restart, never a dead placement
      const attempts = next.attempts + 1;
      const reason = 'no answer to the start handshake';
      return { state: { ...enter(next, 'pending', now, reason), attempts, reported: undefined, deadline: now + NO_PROGRESS_MS }, effects: [{ type: 'regen', reason }] };
    }
    case 'adopting': {
      const reason = 'the kept instance did not reattach';
      return {
        state: { ...enter(next, 'pending', now, reason), reported: undefined, level: undefined, deadline: now + NO_PROGRESS_MS },
        effects: [{ type: 'regen', reason }],
      };
    }
    case 'handshaking':
      return retryLater(next, now, 'the start handshake did not finish in time');
    case 'releasing': {
      if (next.releaseWarned === 0) {
        return { state: { ...next, releaseWarned: 1, deadline: next.since + RELEASE_ACK_FAIL_MS }, effects: [{ type: 'release-slow', final: false }] };
      }
      if (next.releaseWarned === 1) {
        // the release stays open, a later report still completes it
        return { state: { ...next, releaseWarned: 2, deadline: undefined }, effects: [{ type: 'release-slow', final: true }] };
      }
      return stay(next);
    }
    default:
      return stay({ ...next, deadline: undefined });
  }
}

function exitReason(report: WorkloadReport): string {
  const exit = report.lastExit;
  if (!exit) {
    return 'stopped on the worker';
  }
  switch (exit.reason) {
    case 'crashed':
      return exit.signal ? `crashed (${exit.signal})` : `crashed (exit code ${exit.code})`;
    case 'clean':
      return 'exited without a request';
    case 'lease':
      return 'stopped by the lease';
    default:
      return 'stopped on the worker';
  }
}

function levelOf(handshake: number | undefined): 1 | 2 {
  return handshake === 2 ? 2 : 1;
}

function pick(values: number[], index: number): number {
  return values[Math.min(index, values.length - 1)];
}
