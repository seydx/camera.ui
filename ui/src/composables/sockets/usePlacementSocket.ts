import type { SocketChannel } from '@/connection/index.js';
import type { PlacementInfo, PluginRuntimeInfo } from '@shared/types';

const DISPOSAL_GRACE_MS = 5_000;

export interface PlacementSocketState {
  plugins: Record<string, PlacementInfo>;
  cameras: Record<string, PlacementInfo>;
}

const state = reactive<PlacementSocketState>({
  plugins: {},
  cameras: {},
});

let scope: ReturnType<typeof effectScope> | null = null;
let channel: SocketChannel | null = null;
let refCount = 0;
let disposalTimer: ReturnType<typeof setTimeout> | null = null;

function apply(target: Record<string, PlacementInfo>, runtime: Record<string, PluginRuntimeInfo>): void {
  for (const [name, info] of Object.entries(runtime)) {
    if (info.placement) target[name] = info.placement;
  }
}

function load(): void {
  if (!channel?.ready.value) return;
  channel.emit('get-plugin-process-status');
  channel.emit('get-frameworker-process-status');
}

function ensureChannel(): void {
  if (channel) return;

  scope = effectScope(true);
  scope.run(() => {
    const ch = useSocket('/status');
    // assign before onReady: it fires synchronously on a connected socket, and load() reads `channel`
    channel = ch;

    ch.on<Record<string, PluginRuntimeInfo>>('plugin-process-status', (runtime) => apply(state.plugins, runtime));
    ch.on<Record<string, PluginRuntimeInfo>>('frameworker-process-status', (runtime) => apply(state.cameras, runtime));

    ch.onReady(load);
  });
}

function teardown(): void {
  scope?.stop();
  scope = null;
  channel = null;
  state.plugins = {};
  state.cameras = {};
}

export function usePlacementSocket() {
  if (disposalTimer) {
    clearTimeout(disposalTimer);
    disposalTimer = null;
  }
  refCount++;

  function connect(): void {
    ensureChannel();
    load();
  }

  tryOnScopeDispose(() => {
    refCount--;
    if (refCount > 0) return;
    refCount = 0;
    disposalTimer = setTimeout(() => {
      disposalTimer = null;
      if (refCount <= 0) teardown();
    }, DISPOSAL_GRACE_MS);
  });

  return {
    plugins: computed(() => state.plugins),
    cameras: computed(() => state.cameras),

    connect,
  };
}

export function resetPlacementSocket(): void {
  if (disposalTimer) {
    clearTimeout(disposalTimer);
    disposalTimer = null;
  }
  refCount = 0;
  teardown();
}
