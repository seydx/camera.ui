import { readFileSync } from 'node:fs';
import { uptime } from 'node:os';

import { FAILOVER_AFTER_MS, LASTSEEN_WRITE_MS, LEASE_MS, NOTICE_MARGIN_MS, SYNC_INTERVAL_MS } from './timing.js';

import type { DBWorkerLastShutdown } from '../../api/database/types.js';

const DIAG_HOST_BOOT_ID = process.env.CAMERAUI_DIAG_LIFECYCLE === '1' ? process.env.CAMERAUI_DIAG_HOST_BOOT_ID : undefined;

export interface HostClock {
  wall: number;
  upt: number;
  hostBootId?: string;
}

export interface ShutdownInput {
  runId: string;
  reason: string;
  clock: HostClock;
  expectBackMs: number;
  notified: string[];
  restarting: Map<string, number>;
  unanswered: string[];
  previous?: DBWorkerLastShutdown;
}

export function hostClock(): HostClock {
  let hostBootId: string | undefined;
  if (process.platform === 'linux') {
    try {
      hostBootId = readFileSync('/proc/sys/kernel/random/boot_id', 'utf-8').trim() || undefined;
    } catch {
      // not readable in every container
    }
  }
  return { wall: Date.now(), upt: Math.round(uptime() * 1000), hostBootId: hostBootId ?? DIAG_HOST_BOOT_ID };
}

export function holdRest(record: DBWorkerLastShutdown, hold: { until: number; untilUpt: number }, clock: HostClock): number {
  if (record.hostBootId && record.hostBootId === clock.hostBootId) {
    return hold.untilUpt - clock.upt;
  }
  if (record.at <= clock.wall) {
    return hold.until - clock.wall;
  }
  // the wall clock went back, count the hold as if no time passed
  return hold.until - record.at;
}

export function graceRest(agentId: string, lastSeen: number | undefined, record: DBWorkerLastShutdown | undefined, clock: HostClock): number {
  let rest = 0;
  // the last answer may come a write interval and a heartbeat after lastSeen
  if (lastSeen !== undefined && lastSeen >= clock.wall - (FAILOVER_AFTER_MS + LASTSEEN_WRITE_MS + SYNC_INTERVAL_MS)) {
    rest = FAILOVER_AFTER_MS;
  }
  const hold = record?.holds[agentId];
  if (record && hold) {
    const held = holdRest(record, hold, clock);
    if (held > 0) {
      rest = Math.max(rest, held + NOTICE_MARGIN_MS);
    }
  }
  return rest;
}

export function shutdownRecord(input: ShutdownInput): DBWorkerLastShutdown {
  const { clock } = input;
  const holds: DBWorkerLastShutdown['holds'] = {};
  const hold = (agentId: string, rest: number): void => {
    if (rest > 0) {
      holds[agentId] = { until: clock.wall + rest, untilUpt: clock.upt + rest };
    }
  };

  for (const agentId of input.notified) {
    hold(agentId, input.expectBackMs + LEASE_MS);
  }
  for (const [agentId, rest] of input.restarting) {
    if (!holds[agentId]) {
      hold(agentId, rest);
    }
  }
  const previous = input.previous;
  for (const agentId of input.unanswered) {
    const inherited = previous?.holds[agentId];
    if (previous && inherited && !holds[agentId]) {
      hold(agentId, holdRest(previous, inherited, clock));
    }
  }

  return { runId: input.runId, at: clock.wall, upt: clock.upt, hostBootId: clock.hostBootId, reason: input.reason, holds };
}
