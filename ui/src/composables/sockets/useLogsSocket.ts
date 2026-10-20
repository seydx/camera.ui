export type LogTarget = string | undefined;

export interface LogSource {
  kind: 'all' | 'system' | 'camera' | 'plugin';
  id?: string;
}

export interface LogsSocketOptions {
  target?: LogTarget;
  onStdout?: (data: string) => void;
  onDisconnect?: () => void;
  onClearLog?: (source: string) => void;
  onReconnected?: () => void;
}

const channelHolds = new Map<string, number>();

export function useLogsSocket(options: LogsSocketOptions = {}) {
  const { target, onStdout, onDisconnect, onClearLog, onReconnected } = options;
  tryOnScopeDispose(() => releaseChannel());
  const channel = useSocket('/logs');

  let lastRequest: (() => void) | null = null;
  let dynamicUnsub: SocketUnsubscribe | null = null;
  let currentTarget: string | undefined = target;
  let hasConnectedOnce = false;
  let lastCols = 0;
  let heldChannel: string | null = null;

  if (target) {
    channel.on<string>(`stdout/${target}`, (data) => onStdout?.(data));
  }
  channel.on('clear-log', (source?: string) => onClearLog?.(source ?? 'all'));

  channel.onReady(() => {
    // Second+ connect is a reconnect — let the caller reset its terminal.
    if (hasConnectedOnce) onReconnected?.();
    hasConnectedOnce = true;
    lastRequest?.();
  });

  watch(channel.connected, (connected, was) => {
    if (!connected && was) onDisconnect?.();
  });

  function connect(): void {
    // The channel is alive from the moment useLogsSocket() is called
  }

  function disconnect(): void {
    // Channel teardown is tied to the caller's scope via
    // tryOnScopeDispose inside useSocket. No imperative disconnect.
  }

  function reportSize(cols: number): void {
    if (cols > 0) {
      lastCols = cols;
    }
    if (currentTarget && cols > 0) {
      channel.emit('term-size', { target: currentTarget, cols });
    }
  }

  function holdChannel(next: string): void {
    if (next === heldChannel) return;
    releaseChannel();
    heldChannel = next;
    channelHolds.set(next, (channelHolds.get(next) ?? 0) + 1);
  }

  function releaseChannel(): void {
    if (!heldChannel) return;
    const left = (channelHolds.get(heldChannel) ?? 1) - 1;
    if (left > 0) {
      channelHolds.set(heldChannel, left);
    } else {
      channelHolds.delete(heldChannel);
      channel.emit('logs:unsubscribe', { channel: heldChannel });
    }
    heldChannel = null;
  }

  function requestNow(): void {
    if (channel.connected.value) lastRequest?.();
  }

  function channelFor(source: LogSource): string {
    if (source.kind === 'all') return 'stdout';
    if (source.kind === 'system') return `stdout/system/${source.id}`;
    return `stdout/${source.id}`;
  }

  function switchSource(source: LogSource, opts?: { sinceLastStart?: boolean }): void {
    dynamicUnsub?.();
    dynamicUnsub = channel.on<string>(channelFor(source), (data) => onStdout?.(data));
    holdChannel(channelFor(source));
    currentTarget = source.kind === 'all' ? undefined : source.id;

    if (lastCols > 0) {
      reportSize(lastCols);
    }

    lastRequest = () => {
      switch (source.kind) {
        case 'all':
          channel.emit('get-all-logs');
          break;
        case 'system':
          channel.emit('get-system-log', source.id, opts);
          break;
        case 'camera':
          channel.emit('get-camera-log', source.id, opts);
          break;
        case 'plugin':
          channel.emit('get-plugin-log', source.id, opts);
          break;
      }
    };
    requestNow();
  }

  function requestAllLogs(): void {
    holdChannel('stdout');
    lastRequest = () => channel.emit('get-all-logs');
    requestNow();
  }

  function requestCameraLog(cameraName: string, opts?: { sinceLastStart?: boolean }): void {
    holdChannel(`stdout/${cameraName}`);
    lastRequest = () => channel.emit('get-camera-log', cameraName, opts);
    requestNow();
  }

  function requestPluginLog(pluginName: string, opts?: { sinceLastStart?: boolean }): void {
    holdChannel(`stdout/${pluginName}`);
    lastRequest = () => channel.emit('get-plugin-log', pluginName, opts);
    requestNow();
  }

  return {
    isConnected: channel.connected,
    connect,
    disconnect,
    reportSize,
    switchSource,
    requestAllLogs,
    requestCameraLog,
    requestPluginLog,
  };
}
