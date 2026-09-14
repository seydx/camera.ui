import type { SocketChannel } from '@/connection/index.js';
import type { TrainingCandidatesChanged, TrainingSubmitProgress } from '@shared/types';

const state = reactive<{ progress: TrainingSubmitProgress | null }>({ progress: null });

let scope: ReturnType<typeof effectScope> | null = null;
let channel: SocketChannel | null = null;
const changeListeners = new Set<(change: TrainingCandidatesChanged) => void>();
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

function resync(): void {
  loadProgress();
  notify(changeListeners, {});
  notify(resyncListeners, undefined);
}

function ensureChannel(): SocketChannel {
  if (channel) return channel;

  scope = effectScope(true);
  scope.run(() => {
    const ch = useSocket('/training');
    channel = ch;

    ch.on<TrainingCandidatesChanged>('candidates-changed', (change) => notify(changeListeners, change ?? {}));

    ch.on<TrainingSubmitProgress>('submit-progress', (progress) => {
      state.progress = progress;
      notify(changeListeners, {});
    });

    ch.onReady(resync);
  });

  return channel!;
}

export function useTrainingSocket() {
  function connect(): void {
    ensureChannel();
  }

  function onCandidatesChanged(listener: (change: TrainingCandidatesChanged) => void): () => void {
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
  scope?.stop();
  scope = null;
  channel = null;
  state.progress = null;
  changeListeners.clear();
  resyncListeners.clear();
}
