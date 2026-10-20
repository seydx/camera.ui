import type { SocketChannel } from '@/connection/index.js';
import type { TrainingCandidatesChanged, TrainingSubmitProgress } from '@shared/types';

export interface TrainingCandidatesChange extends TrainingCandidatesChanged {
  onlyRemoved?: boolean;
}

const CHANGE_QUIET_MS = 1_000;
const CHANGE_INTERVAL_MS = 5_000;

const state = reactive<{ progress: TrainingSubmitProgress | null }>({ progress: null });

let scope: ReturnType<typeof effectScope> | null = null;
let channel: SocketChannel | null = null;
let pendingChange: TrainingCandidatesChange | null = null;
let pendingSince = 0;
let notifiedAt = 0;
let changeTimer: ReturnType<typeof setTimeout> | null = null;
const changeListeners = new Set<(change: TrainingCandidatesChange) => void>();
const resyncListeners = new Set<() => void>();

function notify<T>(listeners: Set<(payload: T) => void>, payload: T): void {
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // listener errors stay local
    }
  }
}

async function loadProgress(): Promise<void> {
  if (!channel?.ready.value) return;
  try {
    const progress = await channel.request<TrainingSubmitProgress>('get-submit-progress');
    if (progress.active) {
      state.progress = progress;
    } else if (state.progress?.active) {
      state.progress = null;
    }
  } catch {
    // server unreachable
  }
}

function takePendingChange(): TrainingCandidatesChange | null {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = null;
  notifiedAt = Date.now();
  const change = pendingChange;
  pendingChange = null;
  return change;
}

function flushChange(): void {
  const change = takePendingChange();
  if (change) notify(changeListeners, change);
}

function queueChange(change: TrainingCandidatesChanged): void {
  const now = Date.now();
  const removed = change.removed?.length ? change.removed : undefined;
  if (!pendingChange) {
    pendingChange = { cameraId: change.cameraId, removed: removed && [...removed], onlyRemoved: !!removed };
    pendingSince = now;
  } else {
    if (pendingChange.cameraId !== change.cameraId) pendingChange.cameraId = undefined;
    if (removed) pendingChange.removed = [...(pendingChange.removed ?? []), ...removed];
    else pendingChange.onlyRemoved = false;
  }

  const notifyAt = Math.min(pendingSince + CHANGE_INTERVAL_MS, Math.max(now + CHANGE_QUIET_MS, notifiedAt + CHANGE_INTERVAL_MS));
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(flushChange, notifyAt - now);
}

function resync(): void {
  loadProgress();
  const removed = takePendingChange()?.removed;
  notify(changeListeners, removed ? { removed } : {});
  notify(resyncListeners, undefined);
}

function ensureChannel(): SocketChannel {
  if (channel) return channel;

  scope = effectScope(true);
  scope.run(() => {
    const ch = useSocket('/training');
    channel = ch;

    ch.on<TrainingCandidatesChanged>('candidates-changed', (change) => queueChange(change ?? {}));

    // every progress step follows a candidates-changed, which already refreshes the list
    ch.on<TrainingSubmitProgress>('submit-progress', (progress) => {
      state.progress = progress;
    });

    ch.onReady(resync);
  });

  return channel!;
}

export function useTrainingSocket() {
  function connect(): void {
    ensureChannel();
  }

  function onCandidatesChanged(listener: (change: TrainingCandidatesChange) => void): () => void {
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  }

  function onResync(listener: () => void): () => void {
    resyncListeners.add(listener);
    return () => resyncListeners.delete(listener);
  }

  function dismissProgress(): void {
    state.progress = null;
  }

  return {
    submitProgress: computed(() => state.progress),
    connect,
    onCandidatesChanged,
    onResync,
    dismissProgress,
  };
}

export function resetTrainingSocket(): void {
  takePendingChange();
  scope?.stop();
  scope = null;
  channel = null;
  state.progress = null;
  changeListeners.clear();
  resyncListeners.clear();
}
