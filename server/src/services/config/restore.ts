import { copySync, ensureDirSync, moveSync, readJsonSync, removeSync } from 'fs-extra/esm';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import semver from 'semver';

import { sendIPCMessage } from '../../utils/ipc.js';
import { INGRESS_USERNAME, MIN_DATABASE_VERSION } from './constants.js';
import { readMoveRecord, removeMoveRecord } from './move.js';

import type { BackupInfo, RestoreJournal, RestoreMode, RestorePrevious, RestoreStatus, RestoreSwap, RestoreSwapStep } from '../../api/types/index.js';
import type { LoggerService } from '../logger/index.js';

export const BACKUP_IGNORE_FILE = '.backupignore';
export const RESTORE_READY_TTL_MS = 24 * 60 * 60 * 1000;
export const RESTORE_PREVIOUS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESTORE_STATUS_TTL_MS = 30 * 60 * 1000;
export const RESTORE_MAX_BOOTS = 3;
export const RESTORE_UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024;

const FINISHED_STATES = new Set(['done', 'done-with-problems', 'failed', 'rolled-back', 'cancelled', 'expired']);

export interface RestorePaths {
  storage: string;
  root: string;
  staging: string;
  previous: string;
  previousInfo: string;
  journal: string;
  uploads: string;
  backupInfo: string;
  applied: string;
  move: string;
  previousMove: string;
  identity: string[];
}

type RestoreLogger = Pick<LoggerService, 'log' | 'warn' | 'error' | 'attention'>;

export type AppliedRestore = RestoreMode | 'undo';

export type RestoreErrorCode = 'backup-key-required' | 'backup-key-wrong';

export class RestoreError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 422,
    public readonly code?: RestoreErrorCode,
  ) {
    super(message);
  }
}

export class RestoreSwapError extends Error {
  constructor(
    message: string,
    public readonly reverted: boolean,
  ) {
    super(message);
  }
}

export function collectPreservedPaths(storagePath: string, excluded: string[]): Set<string> {
  const preserved = new Set(excluded.map((path) => resolve(path)).filter((path) => existsSync(path)));

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (preserved.has(path)) continue;

      if (entry.isDirectory()) {
        if (existsSync(join(path, BACKUP_IGNORE_FILE))) preserved.add(path);
        else walk(path);
      } else if (!entry.isFile()) {
        preserved.add(path);
      }
    }
  };

  walk(resolve(storagePath));
  return preserved;
}

export function planStorageSwap(storagePath: string, incomingPath: string, asidePath: string, preserved: Set<string>): RestoreSwapStep[] {
  const root = resolve(storagePath);
  const ancestors = new Set<string>();
  for (const path of preserved) {
    for (let dir = dirname(path); dir.startsWith(root + sep) && !ancestors.has(dir); dir = dirname(dir)) {
      ancestors.add(dir);
    }
  }

  const steps: RestoreSwapStep[] = [];

  const setAside = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (preserved.has(path)) continue;
      if (ancestors.has(path)) setAside(path);
      else steps.push({ from: path, to: join(asidePath, relative(root, path)) });
    }
  };

  const bringIn = (from: string, to: string): void => {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isFile()) continue;

      const source = join(from, entry.name);
      const target = join(to, entry.name);
      if (preserved.has(target)) continue;

      if (ancestors.has(target)) {
        if (entry.isDirectory()) bringIn(source, target);
        continue;
      }
      steps.push({ from: source, to: target });
    }
  };

  setAside(root);
  bringIn(resolve(incomingPath), root);
  return steps;
}

export function runStorageSwap(file: string, journal: RestoreJournal, resumed = false): void {
  const { swap } = journal;
  if (!swap) return;

  // only the step a crash interrupted may be half done
  let inDoubt = resumed;
  const save = (): void => {
    inDoubt = false;
    journal.updatedAt = Date.now();
    writeRestoreJournal(file, journal);
  };

  if (!swap.reverting) {
    try {
      while (swap.done < swap.steps.length) {
        runSwapStep(swap.steps[swap.done], inDoubt);
        swap.done++;
        save();
      }
      return;
    } catch (error) {
      swap.reverting = true;
      swap.error = error.message;
      save();
    }
  }

  let complete = true;
  while (swap.done > 0) {
    const step = swap.steps[swap.done - 1];
    try {
      if ('from' in step) runSwapStep({ from: step.to, to: step.from }, inDoubt);
    } catch {
      complete = false;
    }
    swap.done--;
    save();
  }
  throw new RestoreSwapError(swap.error ?? 'unknown error', complete);
}

export function readRestoreJournal(file: string): RestoreJournal | null {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as RestoreJournal;
  } catch {
    return null;
  }
}

export function writeRestoreJournal(file: string, journal: RestoreJournal): void {
  const temp = `${file}.tmp`;
  // holds the secret of a staged move
  writeFileSync(temp, JSON.stringify(journal, null, 2), { mode: 0o600 });
  renameSync(temp, file);
}

export function updateRestoreJournal(file: string, update: (journal: RestoreJournal) => void): RestoreJournal | null {
  const journal = readRestoreJournal(file);
  if (!journal) return null;

  update(journal);
  journal.updatedAt = Date.now();
  writeRestoreJournal(file, journal);
  return journal;
}

export function assertRestorableVersion(version: string | undefined, runningVersion: string): void {
  const backupVersion = semver.valid(version) ? `${semver.major(version!)}.${semver.minor(version!)}.${semver.patch(version!)}` : null;
  if (!backupVersion) {
    throw new RestoreError('The backup does not say which camera.ui version created it.');
  }

  const running = semver.coerce(runningVersion)?.version ?? runningVersion;
  if (semver.gt(backupVersion, running)) {
    throw new RestoreError(`This backup was created with camera.ui ${version}. Update camera.ui to ${backupVersion} or newer, then restore it.`);
  }
  if (semver.lt(backupVersion, MIN_DATABASE_VERSION)) {
    throw new RestoreError(`Backups from camera.ui ${version} can't be restored. The oldest supported version is ${MIN_DATABASE_VERSION}.`);
  }
}

export function dropsIngressAccount(info: Pick<BackupInfo, 'ingress'> | undefined, ingressHost: boolean): boolean {
  return !ingressHost && info?.ingress !== false;
}

export function isIngressAccount(user: { username: string; role: string }): boolean {
  return user.username === INGRESS_USERNAME && user.role === 'master';
}

export function restoreStatus(journal: RestoreJournal): RestoreStatus {
  const { ticketHash, boots, lastBootError, swap, movePeer, ...status } = journal;
  return status;
}

export function isRestoreFinished(journal: RestoreJournal): boolean {
  return FINISHED_STATES.has(journal.state);
}

export function finishRestore(file: string, now = Date.now()): RestoreJournal | null {
  const journal = readRestoreJournal(file);
  if (journal?.state !== 'applied') return null;

  journal.state = journal.plugins.some((plugin) => plugin.state === 'failed' || plugin.state === 'pending') ? 'done-with-problems' : 'done';
  journal.finishedAt = now;
  journal.updatedAt = now;
  writeRestoreJournal(file, journal);
  return journal;
}

export function noteRestoreBootError(file: string, message: string): boolean {
  const journal = readRestoreJournal(file);
  if (journal?.state !== 'applied') return false;

  journal.lastBootError = message;
  journal.updatedAt = Date.now();
  writeRestoreJournal(file, journal);
  return true;
}

export function readRestorePrevious(paths: RestorePaths): RestorePrevious | null {
  if (!existsSync(paths.previous)) return null;

  let createdAt: number;
  try {
    createdAt = readJsonSync(paths.previousInfo).createdAt;
  } catch {
    createdAt = statSync(paths.previous).mtimeMs;
  }
  return { createdAt, expiresAt: createdAt + RESTORE_PREVIOUS_TTL_MS };
}

export function removeExpiredRestoreData(paths: RestorePaths, now = Date.now()): void {
  const journal = readRestoreJournal(paths.journal);
  // an interrupted swap holds both states until the next start finishes it
  if (journal?.swap) return;

  const previous = readRestorePrevious(paths);
  if (previous && previous.expiresAt <= now) {
    removePrevious(paths);
  }

  if (existsSync(paths.uploads)) {
    for (const name of readdirSync(paths.uploads)) {
      const path = join(paths.uploads, name);
      if (now - statSync(path).mtimeMs >= RESTORE_READY_TTL_MS) removeSync(path);
    }
  }

  const since = journal?.state === 'ready' ? journal.createdAt : journal?.state === 'confirmed' ? journal.updatedAt : undefined;
  if (journal && since !== undefined && now - since >= RESTORE_READY_TTL_MS) {
    journal.state = 'expired';
    journal.updatedAt = now;
    journal.finishedAt = now;
    writeRestoreJournal(paths.journal, journal);
    removeSync(paths.staging);
  }
}

export function runPendingRestore(paths: RestorePaths, excluded: string[], logger: RestoreLogger, now = Date.now()): void {
  removeExpiredRestoreData(paths, now);

  const journal = readRestoreJournal(paths.journal);
  let settled = true;
  if (journal?.state === 'confirmed') {
    settled = applyRestore(paths, journal, excluded, logger, now);
  } else if (journal?.state === 'applied') {
    journal.boots++;
    journal.updatedAt = now;
    if (journal.swap || journal.boots > RESTORE_MAX_BOOTS) settled = rollBackRestore(paths, journal, excluded, logger, now);
    else writeRestoreJournal(paths.journal, journal);
  }

  // files that could not be put back stay where the error names them
  if (!settled) return;
  if (journal?.state !== 'ready') removeSync(paths.staging);
  removeSync(join(paths.root, 'discarded'));
}

function applyRestore(paths: RestorePaths, journal: RestoreJournal, excluded: string[], logger: RestoreLogger, now: number): boolean {
  const undo = journal.kind === 'undo';
  const resumed = journal.swap !== undefined;
  let reverted = true;

  logger.attention(undo ? 'Undoing the last restore...' : 'Restoring backup...');
  sendIPCMessage({ type: 'START_OUTPUT', message: undo ? 'Undoing the last restore...' : 'Restoring backup...' });

  try {
    journal.swap ??= startSwap(paths, journal, planRestore(paths, journal, excluded));
    runStorageSwap(paths.journal, journal, resumed);

    writeFileSync(paths.previousInfo, JSON.stringify({ createdAt: now }));
    writeFileSync(paths.applied, undo ? 'undo' : ((journal.mode ?? 'copy') satisfies AppliedRestore));

    journal.state = 'applied';
    journal.boots = 1;
    logger.log(`Backup was restored, the state before it is kept in ${paths.previous} for 7 days`);
  } catch (error) {
    reverted = !(error instanceof RestoreSwapError) || error.reverted;
    if (!undo && reverted) {
      removeSync(paths.previous);
      removeSync(paths.previousInfo);
    }

    journal.state = 'failed';
    journal.error = reverted
      ? `The backup could not be restored, the current state was kept: ${error.message}`
      : `The backup could not be restored and some files could not be put back, they are in ${undo ? join(paths.staging, 'storage') : paths.previous}: ${error.message}`;
    journal.finishedAt = now;
    logger.error(journal.error);
  }

  delete journal.swap;
  journal.updatedAt = now;
  writeRestoreJournal(paths.journal, journal);
  return reverted;
}

function planRestore(paths: RestorePaths, journal: RestoreJournal, excluded: string[]): RestoreSwapStep[] {
  const staged = join(paths.staging, 'storage');
  const movedAway = keepFinishedMove(paths);

  if (journal.kind === 'undo') {
    const stagedMove = join(paths.staging, basename(paths.move));
    removeSync(staged);
    removeSync(stagedMove);
    ensureDirSync(staged);
    const preserved = collectPreservedPaths(paths.storage, keptPaths(paths, paths.previous, true, excluded));
    return [
      ...(movedAway ? [{ from: paths.move, to: stagedMove }] : []),
      ...(existsSync(paths.previousMove) ? [{ from: paths.previousMove, to: paths.move }] : []),
      ...planStorageSwap(paths.storage, paths.previous, staged, preserved),
      { remove: paths.previous },
      { from: staged, to: paths.previous },
      ...(movedAway ? [{ from: stagedMove, to: paths.previousMove }] : []),
    ];
  }

  removePrevious(paths);
  const stagedInfo = join(paths.staging, basename(paths.backupInfo));
  if (existsSync(stagedInfo)) moveSync(stagedInfo, join(staged, basename(paths.backupInfo)), { overwrite: true });

  const preserved = collectPreservedPaths(paths.storage, keptPaths(paths, staged, journal.mode === 'move', excluded));
  return [...planStorageSwap(paths.storage, staged, paths.previous, preserved), ...(movedAway ? [{ from: paths.move, to: paths.previousMove }] : [])];
}

function keepFinishedMove(paths: RestorePaths): boolean {
  const record = readMoveRecord(paths.move);
  if (record?.state === 'sent') return true;
  removeMoveRecord(paths.move, record);
  return false;
}

function startSwap(paths: RestorePaths, journal: RestoreJournal, steps: RestoreSwapStep[]): RestoreSwap {
  journal.swap = { steps, done: 0 };
  journal.updatedAt = Date.now();
  writeRestoreJournal(paths.journal, journal);
  return journal.swap;
}

function removePrevious(paths: RestorePaths): void {
  removeSync(paths.previous);
  removeSync(paths.previousInfo);
  removeSync(paths.previousMove);
}

function rollBackRestore(paths: RestorePaths, journal: RestoreJournal, excluded: string[], logger: RestoreLogger, now: number): boolean {
  const reason = `camera.ui did not start ${RESTORE_MAX_BOOTS} times after the restore${journal.lastBootError ? ` (${journal.lastBootError})` : ''}`;
  const resumed = journal.swap !== undefined;
  const discarded = join(paths.root, 'discarded');
  let reverted = true;

  sendIPCMessage({ type: 'START_OUTPUT', message: 'Putting back the state before the restore...' });

  if (!resumed && !existsSync(paths.previous)) {
    journal.state = 'failed';
    journal.error = `${reason}, and the state before it is gone`;
  } else {
    try {
      if (!journal.swap) {
        removeSync(discarded);
        removeMoveRecord(paths.move, readMoveRecord(paths.move));
        const preserved = collectPreservedPaths(paths.storage, keptPaths(paths, paths.previous, true, excluded));
        const steps = planStorageSwap(paths.storage, paths.previous, discarded, preserved);
        startSwap(paths, journal, existsSync(paths.previousMove) ? [...steps, { from: paths.previousMove, to: paths.move }] : steps);
      }
      runStorageSwap(paths.journal, journal, resumed);

      removeSync(discarded);
      removePrevious(paths);
      journal.state = 'rolled-back';
      journal.error = `${reason}, the state before it is back`;
    } catch (error) {
      reverted = !(error instanceof RestoreSwapError) || error.reverted;
      journal.state = 'failed';
      journal.error = reverted
        ? `${reason}, putting the state before it back failed: ${error.message}`
        : `${reason}, putting the state before it back failed and some files are in ${discarded}: ${error.message}`;
    }
  }

  delete journal.swap;
  journal.finishedAt = now;
  journal.updatedAt = now;
  writeRestoreJournal(paths.journal, journal);
  logger.error(journal.error);
  return reverted;
}

function keptPaths(paths: RestorePaths, incoming: string, takeIdentity: boolean, excluded: string[]): string[] {
  if (!takeIdentity || !paths.identity.every((file) => existsSync(join(incoming, relative(paths.storage, file))))) return excluded;

  const identity = new Set(paths.identity.map((file) => resolve(file)));
  return excluded.filter((path) => !identity.has(resolve(path)));
}

function runSwapStep(step: RestoreSwapStep, inDoubt: boolean): void {
  if ('remove' in step) {
    removeSync(step.remove);
    return;
  }

  const { from, to } = step;
  if (!existsSync(from)) {
    if (inDoubt) return;
    throw new Error(`${from} is missing`);
  }
  if (existsSync(to)) {
    // a copy to another file system reached its target before the crash
    if (inDoubt) {
      removeSync(from);
      return;
    }
    throw new Error(`${to} already exists`);
  }

  ensureDirSync(dirname(to));
  try {
    renameSync(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;

    // the target only shows up complete, a crash leaves just the partial copy
    const partial = `${to}.partial`;
    removeSync(partial);
    copySync(from, partial, { preserveTimestamps: true });
    renameSync(partial, to);
    removeSync(from);
  }
}
