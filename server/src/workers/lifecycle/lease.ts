import { performance } from 'node:perf_hooks';

export interface Stamp {
  wall: number;
  mono: number;
}

export interface LeaseHold {
  runId?: string;
  sent: Stamp;
  untilMs: number;
}

export interface LeaseView {
  answeredSend?: Stamp;
  leaseMs: number;
  hold?: LeaseHold;
}

export function stamp(): Stamp {
  return { wall: Date.now(), mono: performance.now() };
}

export function elapsed(from: Stamp, to: Stamp = stamp()): number {
  return Math.max(to.wall - from.wall, to.mono - from.mono);
}

export function leaseRemaining(view: LeaseView, now: Stamp = stamp()): number | undefined {
  if (!view.answeredSend) {
    return undefined;
  }
  const lease = view.leaseMs - elapsed(view.answeredSend, now);
  const hold = view.hold ? view.hold.untilMs - elapsed(view.hold.sent, now) : -Infinity;
  return Math.max(lease, hold);
}
