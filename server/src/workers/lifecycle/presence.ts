import { shortId } from './format.js';
import { stay } from './reducer.js';
import { FAILOVER_AFTER_MS, SYNC_INTERVAL_MS, WORKER_TIMEOUT_MS } from './timing.js';

import type { DisconnectReason, LeaseState, WorkerState } from '../types.js';
import type { Step } from './reducer.js';

export interface Presence {
  state: WorkerState;
  since: number;
  reason?: string;
  bootId?: string;
  boots: string[];
  buried: string[];
  lastReceive?: number;
  graceUntil?: number;
  holdUntil?: number;
  successorUntil?: number;
  fenced?: boolean;
  release?: 'removed' | 'disabled';
}

export type PresenceEvent =
  | { type: 'heartbeat'; now: number; bootId?: string; prevBootIds?: string[]; lease?: LeaseState }
  | { type: 'disconnect'; now: number; bootId?: string; reason?: DisconnectReason; phase?: 'stopping' | 'stopped'; expectBackMs?: number }
  | { type: 'tick'; now: number }
  | { type: 'paused'; now: number; ms: number }
  | { type: 'outdated'; now: number; reason: string }
  | { type: 'release'; now: number; reason: 'removed' | 'disabled' }
  | { type: 'released'; now: number }
  | { type: 'enable'; now: number };

export type PresenceEffect =
  | { type: 'online'; previous: WorkerState }
  | { type: 'instances-gone'; bootId?: string }
  | { type: 'held'; reason: string }
  | { type: 'resumed' }
  | { type: 'fenced' }
  | { type: 'failover'; reason: string }
  | { type: 'conflict'; boots: [string, string] };

export type AnswerKind = 'normal' | 'holds-only' | 'buried' | 'release' | 'conflict';

export function expectedPresence(now: number, graceUntil: number): Presence {
  return { state: 'expected', since: now, boots: [], buried: [], graceUntil };
}

export function answerKind(presence: Presence, bootId: string | undefined): AnswerKind {
  if (presence.state === 'conflict') return 'conflict';
  if (presence.release) return 'release';
  if (bootId && presence.buried.includes(bootId)) return 'buried';
  if (presence.successorUntil !== undefined) return 'holds-only';
  return 'normal';
}

export function isPlaceable(state: WorkerState): boolean {
  return state === 'expected' || state === 'online' || state === 'unreachable' || state === 'restarting';
}

export function reducePresence(presence: Presence, event: PresenceEvent): Step<Presence, PresenceEffect> {
  switch (event.type) {
    case 'heartbeat':
      return heartbeat(presence, event);
    case 'disconnect':
      return disconnect(presence, event);
    case 'tick':
      return tick(presence, event.now);
    case 'paused':
      return stay(shifted(presence, event.ms));
    case 'outdated':
      return presence.state === 'outdated' && presence.reason === event.reason ? stay(presence) : stay(enter(presence, 'outdated', event.now, event.reason));
    case 'release':
      return stay({ ...enter(presence, 'releasing', event.now), release: event.reason });
    case 'released':
      return stay({ ...enter(presence, 'released', event.now), release: 'disabled' });
    case 'enable':
      return presence.state === 'released' ? stay({ ...enter(presence, 'expected', event.now), release: undefined, graceUntil: event.now }) : stay(presence);
  }
}

export function presenceDeadline(presence: Presence): number | undefined {
  switch (presence.state) {
    case 'expected':
      return presence.graceUntil;
    case 'unreachable':
      return presence.lastReceive === undefined ? undefined : presence.lastReceive + FAILOVER_AFTER_MS;
    case 'restarting':
      return presence.holdUntil;
    default:
      return undefined;
  }
}

function shifted(presence: Presence, ms: number): Presence {
  const later = (at: number | undefined): number | undefined => (at === undefined ? undefined : at + ms);
  return {
    ...presence,
    lastReceive: later(presence.lastReceive),
    graceUntil: later(presence.graceUntil),
    holdUntil: later(presence.holdUntil),
    successorUntil: later(presence.successorUntil),
  };
}

function enter(presence: Presence, state: WorkerState, now: number, reason?: string): Presence {
  return { ...presence, state, since: now, reason };
}

function heartbeat(presence: Presence, event: Extract<PresenceEvent, { type: 'heartbeat' }>): Step<Presence, PresenceEffect> {
  const { now, bootId } = event;
  const received = { ...presence, lastReceive: now };

  if (bootId && presence.buried.includes(bootId)) {
    return stay(presence);
  }
  if (presence.state === 'conflict' || presence.release) {
    return stay(received);
  }

  // an earlier boot is back: two processes share one identity
  if (bootId && bootId !== presence.bootId && presence.boots.includes(bootId) && presence.bootId) {
    return {
      state: { ...enter(received, 'conflict', now, `boots ${shortId(presence.bootId)} and ${shortId(bootId)}`), bootId },
      effects: [{ type: 'conflict', boots: [presence.bootId, bootId] }],
    };
  }

  if (bootId && bootId !== presence.bootId) {
    return newBoot(received, event, presence.lastReceive);
  }

  if (presence.state === 'restarting') {
    // a late heartbeat of the cycle the shutdown cut short
    return stay(received);
  }

  // sent before our last answer could arrive, only link-hint retries come this close
  if (
    (event.lease === 'silent' || event.lease === 'fenced') &&
    presence.state === 'online' &&
    presence.lastReceive !== undefined &&
    now - presence.lastReceive < SYNC_INTERVAL_MS / 2
  ) {
    return stay(received);
  }

  // an offline or expected worker had no answers to lose
  if ((event.lease === 'silent' || event.lease === 'fenced') && (presence.state === 'online' || presence.state === 'unreachable')) {
    return answersLost(received, event.lease, now);
  }

  const back = { ...received, fenced: undefined };
  switch (presence.state) {
    case 'online':
      return stay(back);
    case 'unreachable':
      return { state: enter(back, 'online', now), effects: [{ type: 'resumed' }] };
    default:
      return { state: { ...enter(back, 'online', now), graceUntil: undefined, holdUntil: undefined }, effects: [{ type: 'online', previous: presence.state }] };
  }
}

function newBoot(presence: Presence, event: Extract<PresenceEvent, { type: 'heartbeat' }>, lastOld = event.now): Step<Presence, PresenceEffect> {
  const { now } = event;
  const bootId = event.bootId!;
  const previous = presence.bootId;
  const confirmed = !previous || (event.prevBootIds ?? []).includes(previous) || presence.buried.includes(previous);
  const next: Presence = {
    ...enter(presence, 'online', now),
    bootId,
    boots: [...presence.boots, bootId],
    graceUntil: undefined,
    holdUntil: undefined,
    fenced: undefined,
    successorUntil: undefined,
  };
  const effects: PresenceEffect[] = [];
  if (presence.state !== 'online') {
    effects.push({ type: 'online', previous: presence.state });
  }

  if (confirmed) {
    if (previous) {
      effects.push({ type: 'instances-gone', bootId: previous });
    }
    return { state: next, effects };
  }

  // nats may only have pushed the old boot's leaf off, its lease ends by then
  return { state: { ...next, successorUntil: lastOld + FAILOVER_AFTER_MS }, effects };
}

function answersLost(presence: Presence, lease: LeaseState, now: number): Step<Presence, PresenceEffect> {
  const reason = 'answers do not arrive';
  const effects: PresenceEffect[] = [];
  let next = presence.state === 'unreachable' ? presence : enter(presence, 'unreachable', now, reason);
  if (presence.state !== 'unreachable') {
    effects.push({ type: 'held', reason });
  }

  if (lease === 'fenced') {
    if (presence.fenced) {
      // the answer to the first fenced report did not arrive either
      return {
        state: { ...enter(next, 'offline', now, 'answers do not arrive (lease fenced)'), fenced: undefined },
        effects: [...effects, { type: 'failover', reason: 'lease fenced' }],
      };
    }
    next = { ...next, fenced: true };
    effects.push({ type: 'fenced' });
  }
  return { state: next, effects };
}

function disconnect(presence: Presence, event: Extract<PresenceEvent, { type: 'disconnect' }>): Step<Presence, PresenceEffect> {
  const { now } = event;
  if (event.bootId && presence.bootId && event.bootId !== presence.bootId) {
    return stay(presence);
  }
  if (presence.state === 'conflict' || presence.release || presence.state === 'offline' || presence.state === 'outdated') {
    return stay(presence);
  }

  // an older agent sends no reason, its work moves at once
  if (!event.reason) {
    return { state: enter(presence, 'offline', now, 'stopped'), effects: [{ type: 'failover', reason: 'stopped' }] };
  }

  const lastReceive = presence.lastReceive ?? now;
  const holdUntil = Math.max(lastReceive + FAILOVER_AFTER_MS, now + (event.expectBackMs ?? 0));
  const reason = describeDisconnect(event.reason);
  const effects: PresenceEffect[] = [];
  let next = presence;

  if (presence.state !== 'restarting') {
    next = { ...enter(presence, 'restarting', now, reason), holdUntil };
    effects.push({ type: 'held', reason });
  } else if (event.phase === 'stopping') {
    next = { ...presence, holdUntil, reason };
  }

  if (event.phase === 'stopped') {
    const bootId = event.bootId ?? presence.bootId;
    next = { ...next, buried: bootId ? [...next.buried, bootId] : next.buried };
    effects.push({ type: 'instances-gone', bootId });
    if (event.reason === 'stop' || event.reason === 'suspend') {
      next = enter(next, 'offline', now, reason);
      effects.push({ type: 'failover', reason });
    }
  }

  return { state: next, effects };
}

function tick(presence: Presence, now: number): Step<Presence, PresenceEffect> {
  const effects: PresenceEffect[] = [];
  let next = presence;

  if (next.successorUntil !== undefined && now >= next.successorUntil) {
    next = { ...next, successorUntil: undefined };
    effects.push({ type: 'instances-gone' });
  }

  switch (next.state) {
    case 'expected':
      if (next.graceUntil !== undefined && now >= next.graceUntil) {
        return {
          state: { ...enter(next, 'offline', now, 'did not connect'), graceUntil: undefined },
          effects: [...effects, { type: 'failover', reason: 'did not connect' }],
        };
      }
      break;
    case 'online':
      if (next.lastReceive !== undefined && now - next.lastReceive > WORKER_TIMEOUT_MS) {
        const reason = 'not answering';
        return { state: enter(next, 'unreachable', now, reason), effects: [...effects, { type: 'held', reason }] };
      }
      break;
    case 'unreachable':
      if (next.lastReceive !== undefined && now >= next.lastReceive + FAILOVER_AFTER_MS) {
        return { state: { ...enter(next, 'offline', now, 'no heartbeat'), fenced: undefined }, effects: [...effects, { type: 'failover', reason: 'no heartbeat' }] };
      }
      break;
    case 'restarting':
      if (next.holdUntil !== undefined && now >= next.holdUntil) {
        const reason = 'did not come back after the restart';
        return { state: { ...enter(next, 'offline', now, reason), holdUntil: undefined }, effects: [...effects, { type: 'failover', reason }] };
      }
      break;
  }

  return { state: next, effects };
}

function describeDisconnect(reason: DisconnectReason): string {
  switch (reason) {
    case 'update':
      return 'restarting for an update';
    case 'stop':
      return 'stopped';
    case 'suspend':
      return 'went to sleep';
    default:
      return 'restarting';
  }
}
