import type { SocketChannel } from '@/connection/index.js';
import type { Go2RTCOfferCodec } from '@shared/types';

export type StreamStatus = 'connected' | 'connecting' | 'error' | 'idle' | 'partial';
export type CameraStreamStatus = Record<string, Record<string, StreamStatus>>;
export type CameraStreamConnections = Record<string, Record<string, number>>;
export interface StreamCodecs {
  video: Go2RTCOfferCodec[];
  audio: Go2RTCOfferCodec[];
}
export type CameraStreamCodecs = Record<string, Record<string, StreamCodecs | undefined>>;
export interface CameraStreamDelta {
  status: Record<string, StreamStatus>;
  connections: Record<string, number>;
  codecs?: Record<string, StreamCodecs | undefined>;
}

const DISPOSAL_GRACE_MS = 5_000;

const state = reactive<{ streamStatus: CameraStreamStatus; streamConnections: CameraStreamConnections; streamCodecs: CameraStreamCodecs }>({
  streamStatus: {},
  streamConnections: {},
  streamCodecs: {},
});

let scope: ReturnType<typeof effectScope> | null = null;
let channel: SocketChannel | null = null;
let refCount = 0;
let disposalTimer: ReturnType<typeof setTimeout> | null = null;

function refresh(): void {
  channel?.emit('get-stream-status', { deltas: true });
}

function applyDelta(delta: Record<string, CameraStreamDelta | null>): void {
  for (const [cameraId, camera] of Object.entries(delta)) {
    if (!camera) {
      delete state.streamStatus[cameraId];
      delete state.streamConnections[cameraId];
      delete state.streamCodecs[cameraId];
      continue;
    }
    state.streamStatus[cameraId] = camera.status;
    state.streamConnections[cameraId] = camera.connections;
    if (camera.codecs) state.streamCodecs[cameraId] = camera.codecs;
  }
}

function teardown(): void {
  channel?.emit('stream-status:unsubscribe');
  scope?.stop();
  scope = null;
  channel = null;
  state.streamStatus = {};
  state.streamConnections = {};
  state.streamCodecs = {};
}

function ensureChannel(): SocketChannel {
  if (channel) return channel;

  scope = effectScope(true);
  scope.run(() => {
    const ch = useSocket('/camera.ui');
    // Assign before onReady: onReady fires synchronously when the socket is
    // already connected, and refresh() reads the module-level `channel`.
    channel = ch;

    ch.on<CameraStreamStatus>('stream-status', (data) => {
      state.streamStatus = data;
    });

    ch.on<CameraStreamConnections>('stream-connections', (data) => {
      state.streamConnections = data;
    });

    ch.on<CameraStreamCodecs>('stream-codecs', (data) => {
      state.streamCodecs = data;
    });

    ch.on<Record<string, CameraStreamDelta | null>>('stream-status-delta', applyDelta);

    ch.onReady(() => {
      refresh();
    });
  });

  return channel!;
}

function deriveCameraStatus(sources: Record<string, StreamStatus>): StreamStatus {
  const values = Object.values(sources);
  if (values.length === 0) return 'idle';
  const connectedCount = values.filter((s) => s === 'connected').length;
  const errorCount = values.filter((s) => s === 'error').length;
  const connectingCount = values.filter((s) => s === 'connecting').length;
  if (connectedCount === values.length) return 'connected';
  if (errorCount === values.length) return 'error';
  if (connectingCount > 0 && connectedCount === 0 && errorCount === 0) return 'connecting';
  if (connectedCount > 0 && (errorCount > 0 || values.some((s) => s === 'idle'))) return 'partial';
  if (connectedCount > 0) return 'connected';
  if (connectingCount > 0) return 'connecting';
  return 'idle';
}

export function useStreamStatus() {
  if (disposalTimer) {
    clearTimeout(disposalTimer);
    disposalTimer = null;
  }
  refCount++;

  function connect(): void {
    ensureChannel();
  }

  function disconnect(): void {
    // Channel teardown is global via resetStreamStatus().
  }

  function getCameraStatus(cameraId: string): StreamStatus {
    const sources = state.streamStatus[cameraId];
    if (!sources) return 'idle';
    return deriveCameraStatus(sources);
  }

  function getCameraSources(cameraId: string): Record<string, StreamStatus> | undefined {
    return state.streamStatus[cameraId];
  }

  function getSourceStatus(cameraId: string, sourceName: string): StreamStatus {
    return state.streamStatus[cameraId]?.[sourceName] ?? 'idle';
  }

  function getSourceConnections(cameraId: string, sourceName: string): number {
    return state.streamConnections[cameraId]?.[sourceName] ?? 0;
  }

  function getSourceCodecs(cameraId: string, sourceName: string): StreamCodecs | undefined {
    return state.streamCodecs[cameraId]?.[sourceName];
  }

  return {
    streamStatus: computed(() => state.streamStatus),
    getCameraStatus,
    getCameraSources,
    getSourceStatus,
    getSourceConnections,
    getSourceCodecs,
    connect,
    disconnect,
    refresh,
  };
}

export function resetStreamStatus(): void {
  if (disposalTimer) {
    clearTimeout(disposalTimer);
    disposalTimer = null;
  }
  refCount = 0;
  teardown();
}
