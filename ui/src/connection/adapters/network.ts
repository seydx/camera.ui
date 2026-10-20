import { isCapacitor } from '../runtime.js';

export const NETWORK_PATH_EVENT = 'path';

export interface NetworkAdapters {
  readonly networkSource: EventTarget;
  readonly networkChangeSource?: EventTarget;
}

export function createNetworkAdapters(): NetworkAdapters {
  if (isCapacitor) {
    return createCapacitorNetworkAdapters();
  }
  return { networkSource: window };
}

function createCapacitorNetworkAdapters(): NetworkAdapters {
  const networkSource = new EventTarget();
  const networkChangeSource = new EventTarget();

  let lastConnected: boolean | null = null;
  let lastType: string | null = null;

  (async () => {
    const { Network } = await import('@capacitor/network');

    const status = await Network.getStatus();
    lastConnected = status.connected;
    lastType = status.connectionType;

    Network.addListener('networkStatusChange', (next) => {
      const connectivityChanged = lastConnected !== next.connected;
      if (connectivityChanged) {
        lastConnected = next.connected;
        networkSource.dispatchEvent(new Event(next.connected ? 'online' : 'offline'));
      }
      // wifi/cellular switch while connected, a separate signal lets USER_RETRY escape the backoff
      if (next.connected && lastType !== next.connectionType) {
        lastType = next.connectionType;
        networkChangeSource.dispatchEvent(new Event('change'));
      } else if (next.connected && !connectivityChanged) {
        networkChangeSource.dispatchEvent(new Event(NETWORK_PATH_EVENT));
      }
    });
  })();

  return { networkSource, networkChangeSource };
}
