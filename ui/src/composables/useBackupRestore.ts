import { isAxiosError } from '@/api/errors.js';
import {
  appendRestoreUploadFn,
  cancelMovePullFn,
  cancelRestoreFn,
  completeRestoreUploadFn,
  confirmRestoreFn,
  createRestoreUploadFn,
  movePullStatusFn,
  removeRestoreUploadFn,
  restoreScheduledBackupFn,
  restoreStatusFn,
  restoreUploadStatusFn,
  startMovePullFn,
  undoRestoreFn,
} from '@/api/routes/backup.js';
import { extractErrorMessage } from '@/common/utils.js';

import type { MovePullStatus, RestoreMode, RestoreNotice, RestoreStarted, RestoreState, RestoreStatus, RestoreUpload, UiLocalStorage } from '@shared/types';

export type BackupRestorePhase = 'idle' | 'uploading' | 'moving' | 'checking' | 'key' | 'ready' | 'applying' | 'finished';

export type BackupKeyProblem = 'backup-key-required' | 'backup-key-wrong';

type KeyedSource = { upload: string } | { filename: string };

interface StoredRestore {
  ticket: string;
  localStorage: Partial<UiLocalStorage>;
}

interface StoredUpload {
  key: string;
  id: string;
}

const RESTORE_SESSION_KEY = 'cui-restore';
const UPLOAD_SESSION_KEY = 'cui-restore-upload';
const LOGIN_SESSION_KEY = 'cui-restore-login';
const MOVE_SESSION_KEY = 'cui-restore-move';
const POLL_INTERVAL_MS = 2000;
const UPLOAD_RETRIES = 5;
const FINISHED_STATES = new Set<RestoreState>(['done', 'done-with-problems', 'failed', 'rolled-back', 'cancelled', 'expired']);
const LOGIN_NOTICE_STATES = new Set<RestoreState>(['confirmed', 'applied', 'done', 'done-with-problems', 'failed', 'rolled-back']);

const phase = ref<BackupRestorePhase>('idle');
const status = ref<(RestoreNotice & Partial<RestoreStatus>) | null>(null);
const uploadTotal = ref(0);
const uploadLoaded = ref(0);
const pull = ref<MovePullStatus | null>(null);
const lastError = ref('');
const busy = ref(false);
const keyProblem = ref<BackupKeyProblem | null>(null);
let keyedSource: KeyedSource | null = null;

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let uploadCancelled = false;

export const isRestoreActive = computed(() => phase.value !== 'idle');

function readSession<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode: only a reload loses track of the restore
  }
}

function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function applyLocalStorage(ls: Partial<UiLocalStorage>): void {
  if (ls.theme) {
    localStorage.setItem('theme', JSON.stringify(ls.theme));
  }

  if (ls.language) {
    localStorage.setItem('language', ls.language);
  }

  if (ls.ui) {
    localStorage.setItem('ui', JSON.stringify(ls.ui));
  }
}

function isFinished(state: RestoreState): boolean {
  return FINISHED_STATES.has(state);
}

function isSuccess(state: RestoreState | undefined): boolean {
  return state === 'done' || state === 'done-with-problems';
}

function isRetryable(error: unknown): boolean {
  const code = isAxiosError(error) ? error.response?.status : undefined;
  return !code || code === 409 || code >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reset(): void {
  clearTimeout(pollTimer);
  phase.value = 'idle';
  status.value = null;
  uploadTotal.value = 0;
  uploadLoaded.value = 0;
  pull.value = null;
  busy.value = false;
  keyProblem.value = null;
  keyedSource = null;
}

function backupKeyProblem(error: unknown): BackupKeyProblem | null {
  if (!isAxiosError(error) || error.response?.status !== 422) return null;
  const code = (error.response.data as { code?: string } | undefined)?.code;
  return code === 'backup-key-required' || code === 'backup-key-wrong' ? code : null;
}

async function stageKeyed(source: KeyedSource, key?: string): Promise<void> {
  phase.value = 'checking';
  try {
    staged('upload' in source ? await completeRestoreUploadFn(source.upload, key) : await restoreScheduledBackupFn(source.filename, key));
    keyedSource = null;
    keyProblem.value = null;
  } catch (error) {
    const problem = backupKeyProblem(error);
    if (!problem) {
      fail(error);
      return;
    }
    keyedSource = source;
    keyProblem.value = problem;
    phase.value = 'key';
  }
}

function fail(error: unknown): void {
  reset();
  lastError.value = extractErrorMessage(error);
  useCuiToast().add({ severity: 'error', detail: lastError.value, life: 10000 });
}

function staged(started: RestoreStarted): void {
  writeSession(RESTORE_SESSION_KEY, { ticket: started.ticket, localStorage: started.localStorage } satisfies StoredRestore);
  status.value = started.status;
  phase.value = 'ready';
}

function settle(current: RestoreNotice & Partial<RestoreStatus>): void {
  status.value = { ...status.value, ...current };

  if (isFinished(current.state)) {
    phase.value = 'finished';
    const stored = readSession<StoredRestore>(RESTORE_SESSION_KEY);
    if (isSuccess(current.state) && stored) applyLocalStorage(stored.localStorage);
  }
}

function poll(): void {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    try {
      const current = await restoreStatusFn(readSession<StoredRestore>(RESTORE_SESSION_KEY)?.ticket);
      if (!current || current.id !== status.value?.id) {
        phase.value = 'finished';
        return;
      }

      settle(current);
    } catch {
      // the server is restarting
    }

    if (phase.value === 'applying') poll();
  }, POLL_INTERVAL_MS);
}

function pollPull(): void {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    try {
      const current = await movePullStatusFn();
      if (!current || current.state === 'cancelled') {
        removeSession(MOVE_SESSION_KEY);
        reset();
        return;
      }

      pull.value = current;
      if (current.state === 'staged' && current.started) {
        removeSession(MOVE_SESSION_KEY);
        staged(current.started);
        return;
      }
      if (current.state === 'failed') {
        removeSession(MOVE_SESSION_KEY);
        fail(new Error(current.error));
        return;
      }
    } catch {
      // not reachable now, the next round asks again
    }

    if (phase.value === 'moving') pollPull();
  }, POLL_INTERVAL_MS);
}

async function openUpload(file: File): Promise<RestoreUpload> {
  const key = `${file.name}:${file.size}:${file.lastModified}`;
  const stored = readSession<StoredUpload>(UPLOAD_SESSION_KEY);

  if (stored?.key === key) {
    try {
      return await restoreUploadStatusFn(stored.id);
    } catch {
      // expired or removed, start over
    }
  }

  const upload = await createRestoreUploadFn(file.size, file.name);
  writeSession(UPLOAD_SESSION_KEY, { key, id: upload.id } satisfies StoredUpload);
  return upload;
}

async function sendParts(file: File, upload: RestoreUpload): Promise<void> {
  let received = upload.received;
  let failures = 0;

  while (received < file.size && !uploadCancelled) {
    const offset = received;
    try {
      const chunk = file.slice(offset, Math.min(offset + upload.chunkSize, file.size));
      received = (await appendRestoreUploadFn(upload.id, offset, chunk, (loaded) => (uploadLoaded.value = offset + loaded))).received;
      failures = 0;
    } catch (error) {
      if (!isRetryable(error) || ++failures > UPLOAD_RETRIES) throw error;
      await wait(failures * 1000);
      received = await restoreUploadStatusFn(upload.id)
        .then((current) => current.received)
        .catch(() => offset);
    }
    uploadLoaded.value = received;
  }
}

export function useBackupRestore() {
  const uploadPercent = computed(() => (uploadTotal.value ? Math.round((uploadLoaded.value / uploadTotal.value) * 100) : 0));
  const movePercent = computed(() => (pull.value?.size ? Math.round((pull.value.received / pull.value.size) * 100) : 0));

  async function upload(file: File): Promise<void> {
    if (isRestoreActive.value) return;

    phase.value = 'uploading';
    lastError.value = '';
    uploadTotal.value = file.size;
    uploadLoaded.value = 0;
    uploadCancelled = false;

    try {
      const target = await openUpload(file);
      await sendParts(file, target);

      if (uploadCancelled) {
        removeSession(UPLOAD_SESSION_KEY);
        await removeRestoreUploadFn(target.id).catch(() => {});
        reset();
        return;
      }

      removeSession(UPLOAD_SESSION_KEY);
      await stageKeyed({ upload: target.id });
    } catch (error) {
      fail(error);
    }
  }

  function cancelUpload(): void {
    uploadCancelled = true;
  }

  async function stageScheduled(filename: string): Promise<void> {
    if (isRestoreActive.value) return;

    lastError.value = '';
    await stageKeyed({ filename });
  }

  async function submitKey(key: string): Promise<void> {
    if (keyedSource) await stageKeyed(keyedSource, key);
  }

  async function cancelKey(): Promise<void> {
    busy.value = true;
    if (keyedSource && 'upload' in keyedSource) await removeRestoreUploadFn(keyedSource.upload).catch(() => {});
    reset();
  }

  async function fetchFromServer(code: string, address?: string): Promise<void> {
    if (isRestoreActive.value) return;

    phase.value = 'moving';
    lastError.value = '';

    try {
      const fd = new FormData();
      fd.append('upload', file);

      const ls = await restoreBackupFn(fd, (p) => {
        uploadPercent.value = p;
        if (p >= 100) phase.value = 'restoring';
      });

  async function confirm(mode: RestoreMode): Promise<void> {
    busy.value = true;

    try {
      settle(await confirmRestoreFn(mode));
      phase.value = 'applying';
      poll();
    } catch (error) {
      useCuiToast().add({ severity: 'error', detail: extractErrorMessage(error), life: 10000 });
    } finally {
      busy.value = false;
    }
  }

  async function cancel(): Promise<void> {
    busy.value = true;
    await cancelRestoreFn().catch(() => {});
    removeSession(RESTORE_SESSION_KEY);
    reset();
  }

  async function undo(): Promise<void> {
    if (isRestoreActive.value) return;

    try {
      const started = await undoRestoreFn();
      writeSession(RESTORE_SESSION_KEY, { ticket: started.ticket, localStorage: {} } satisfies StoredRestore);
      status.value = started.status;
      phase.value = 'applying';
      poll();
    } catch (error) {
      fail(error);
    }
  }

  async function close(): Promise<void> {
    const signOut = isSuccess(status.value?.state);
    const stored = readSession<StoredRestore>(RESTORE_SESSION_KEY);
    if (signOut && stored) writeSession(LOGIN_SESSION_KEY, stored.ticket);
    removeSession(RESTORE_SESSION_KEY);
    reset();

    if (signOut) await useAuthStore().logout();
  }

  async function loginNotice(): Promise<(RestoreNotice & Partial<RestoreStatus>) | null> {
    const ticket = readSession<string>(LOGIN_SESSION_KEY) ?? readSession<StoredRestore>(RESTORE_SESSION_KEY)?.ticket;

    try {
      const current = await restoreStatusFn(ticket ?? undefined);
      if (!current) removeSession(LOGIN_SESSION_KEY);
      return current && LOGIN_NOTICE_STATES.has(current.state) ? current : null;
    } catch {
      return null;
    }
  }

  async function resume(): Promise<void> {
    if (isRestoreActive.value) return;

    const stored = readSession<StoredRestore>(RESTORE_SESSION_KEY);
    if (!stored) {
      if (readSession<boolean>(MOVE_SESSION_KEY)) {
        phase.value = 'moving';
        pollPull();
      }
      return;
    }

    try {
      const current = await restoreStatusFn(stored.ticket);
      if (!current || current.state === 'cancelled' || current.state === 'expired') {
        removeSession(RESTORE_SESSION_KEY);
        return;
      }

      settle(current);
      if (current.state === 'ready') {
        phase.value = 'ready';
      } else if (!isFinished(current.state)) {
        phase.value = 'applying';
        poll();
      }
    } catch {
      // not reachable now, the next load tries again
    }
  }

  return {
    phase,
    status,
    uploadTotal,
    uploadLoaded,
    uploadPercent,
    pull,
    movePercent,
    lastError,
    busy,
    keyProblem,
    upload,
    cancelUpload,
    fetchFromServer,
    cancelFetch,
    stageScheduled,
    submitKey,
    cancelKey,
    showStaged,
    confirm,
    cancel,
    undo,
    close,
    resume,
    loginNotice,
  };
}
