import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

import type { MoveState, MoveStatus } from '../../api/types/index.js';

export const MOVE_OFFER_TTL_MS = 30 * 60 * 1000;
export const MOVE_READY_TTL_MS = 30 * 60 * 1000;

const CODE_VERSION = 1;
const MAX_CODE_HOSTS = 8;
const MOVED_AWAY_STATES = new Set<MoveState>(['preparing', 'packing', 'ready', 'sent']);

export interface MoveRecord extends MoveStatus {
  secretHash: string;
  archive?: string;
  archiveDirectory?: string;
}

export interface MoveCode {
  hosts: string[];
  secret: string;
  fingerprint: string;
}

export function readMoveRecord(file: string): MoveRecord | null {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as MoveRecord;
  } catch {
    return null;
  }
}

export function writeMoveRecord(file: string, record: MoveRecord): void {
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify(record, null, 2));
  renameSync(temp, file);
}

export function removeMoveRecord(file: string, record?: MoveRecord | null): void {
  if (record?.archiveDirectory) rmSync(record.archiveDirectory, { recursive: true, force: true });
  rmSync(file, { force: true });
}

export function settleMoveRecord(file: string, now = Date.now()): MoveRecord | null {
  const record = readMoveRecord(file);
  if (!record) return null;

  const expired = (record.state === 'offered' && record.expiresAt <= now) || (record.state === 'ready' && (record.readyUntil ?? 0) <= now);
  if (expired) {
    removeMoveRecord(file, record);
    return null;
  }
  return record;
}

export function isMovedAway(record: MoveRecord | null): boolean {
  return !!record && MOVED_AWAY_STATES.has(record.state);
}

export function moveStatus(record: MoveRecord): MoveStatus {
  const { secretHash, archive, archiveDirectory, ...status } = record;
  return status;
}

export function newMoveSecret(): string {
  return randomBytes(16).toString('base64url');
}

export function hashMoveSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function moveSecretMatches(record: MoveRecord, secret: string): boolean {
  const expected = Buffer.from(record.secretHash, 'hex');
  const actual = Buffer.from(hashMoveSecret(secret), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function certificateFingerprint(der: Buffer): string {
  return createHash('sha256').update(der).digest('base64url');
}

export function encodeMoveCode(code: MoveCode): string {
  return Buffer.from(JSON.stringify({ v: CODE_VERSION, h: code.hosts.slice(0, MAX_CODE_HOSTS), s: code.secret, f: code.fingerprint })).toString('base64url');
}

export function decodeMoveCode(text: string): MoveCode | null {
  try {
    const { v, h, s, f } = JSON.parse(Buffer.from(text.replace(/\s+/g, ''), 'base64url').toString('utf-8'));
    const hosts = Array.isArray(h) ? h.filter((host): host is string => typeof host === 'string').slice(0, MAX_CODE_HOSTS) : [];
    if (v !== CODE_VERSION || !hosts.length || typeof s !== 'string' || typeof f !== 'string') return null;
    return { hosts, secret: s, fingerprint: f };
  } catch {
    return null;
  }
}
