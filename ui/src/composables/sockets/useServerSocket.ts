import type { SocketChannel } from '@/connection/index.js';
import type { INpmPluginState } from '@shared/types';

export interface ServerSocketState {
  serverUpdateAvailable: boolean;
  pluginUpdateAvailable: boolean;
  workerUpdateAvailable: boolean;
  serverUpdate: INpmPluginState | null;
  pluginUpdates: INpmPluginState[];
}

const state = reactive<ServerSocketState>({
  serverUpdateAvailable: false,
  pluginUpdateAvailable: false,
  workerUpdateAvailable: false,
  serverUpdate: null,
  pluginUpdates: [],
});

let scope: ReturnType<typeof effectScope> | null = null;
let channel: SocketChannel | null = null;

async function fetchUpdates(): Promise<void> {
  if (!channel?.ready.value) return;
  try {
    const data = await channel.request<{ plugins: INpmPluginState[]; server: INpmPluginState; workerUpdateAvailable?: boolean }>('get-updates');
    state.pluginUpdates = data.plugins;
    state.pluginUpdateAvailable = data.plugins.length > 0;
    state.serverUpdate = data.server;
    state.serverUpdateAvailable = data.server.updateAvailable || data.server.betaUpdateAvailable || false;
    state.workerUpdateAvailable = data.workerUpdateAvailable ?? false;
  } catch {
    // unreachable, the reconnect fetches again
  }
}

function ensureChannel(): SocketChannel {
  if (channel) return channel;

  scope = effectScope(true);
  scope.run(() => {
    const ch = useSocket('/server');
    // assign before onReady: it fires synchronously on a connected socket, and fetchUpdates() reads `channel`
    channel = ch;

    ch.on<INpmPluginState[]>('plugin-updates', (plugins) => {
      state.pluginUpdates = plugins;
      state.pluginUpdateAvailable = plugins.length > 0;
    });

    ch.on<INpmPluginState>('server-updates', (server) => {
      state.serverUpdate = server;
      state.serverUpdateAvailable = server.updateAvailable || server.betaUpdateAvailable || false;
    });

    ch.on<{ updateAvailable: boolean }>('worker-updates', (workers) => {
      state.workerUpdateAvailable = workers.updateAvailable;
    });

    ch.onReady(() => {
      fetchUpdates();
    });
  });

  return channel!;
}

export function useServerSocket() {
  function connect(): void {
    ensureChannel();
  }

  function disconnect(): void {
    // teardown runs in resetServerSocket()
  }

  return {
    isConnected: computed(() => channel?.connected.value ?? false),
    serverUpdateAvailable: computed(() => state.serverUpdateAvailable),
    pluginUpdateAvailable: computed(() => state.pluginUpdateAvailable),
    workerUpdateAvailable: computed(() => state.workerUpdateAvailable),
    serverUpdate: computed(() => state.serverUpdate),
    pluginUpdates: computed(() => state.pluginUpdates),
    connect,
    disconnect,
    fetchUpdates,
  };
}

export function resetServerSocket(): void {
  scope?.stop();
  scope = null;
  channel = null;
  state.serverUpdateAvailable = false;
  state.pluginUpdateAvailable = false;
  state.workerUpdateAvailable = false;
  state.serverUpdate = null;
  state.pluginUpdates = [];
}
