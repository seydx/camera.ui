import type { RPCClient } from '@camera.ui/rpc';

// interest needs a moment to cross a fresh link, the jitter spreads a host's plugins
const RESYNC_DELAY_MS = 150;
const RESYNC_JITTER_MS = 500;

interface WatchReconnectOptions {
  debounce?: boolean;
}

export function watchReconnect(
  proxy: RPCClient,
  onReconnect: () => Promise<void>,
  onEnd: (error: unknown) => void,
  options: WatchReconnectOptions = {},
): (() => void) | undefined {
  const status = proxy.status();
  if (!status) return undefined;

  const iterator = status[Symbol.asyncIterator]();
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let unsubscribeLink: (() => void) | undefined;

  const schedule = (): void => {
    if (stopped || timer) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        if (!stopped) onReconnect().catch(() => {});
      },
      RESYNC_DELAY_MS + Math.random() * RESYNC_JITTER_MS,
    );
    timer.unref();
  };

  // a worker's own connection stays up when its link to the master drops
  const linkSubject = process.env.CAMERAUI_WORKER_LINK_SUBJECT;
  if (options.debounce && linkSubject) {
    proxy.subscribe(linkSubject, schedule).then((unsubscribe) => {
      if (stopped) unsubscribe();
      else unsubscribeLink = unsubscribe;
    }, onEnd);
  }

  (async () => {
    try {
      while (!stopped) {
        const next = await iterator.next();
        if (next.done || stopped) break;
        if (next.value.type !== 'reconnect') continue;
        if (options.debounce) schedule();
        else await onReconnect();
      }
    } catch (error) {
      onEnd(error);
    }
  })();

  return () => {
    stopped = true;
    clearTimeout(timer);
    timer = undefined;
    unsubscribeLink?.();
    iterator.return?.()?.catch(() => {});
  };
}
