import { embedHost, isEmbedded, isProxySignIn, runtimeBase } from '@/common/base.js';

import { createNetworkAdapters } from '../adapters/network.js';
import { createStorageAdapter } from '../adapters/storage.js';
import { createVisibilitySource } from '../adapters/visibility.js';
import { createWakeSource } from '../adapters/wake.js';
import { createAuthApi } from '../auth/api.js';
import { createDiscoverDirect } from '../auth/discover.js';
import { createProbe } from '../auth/probe.js';
import { createRefresh } from '../auth/refresh.js';

import type { Logger } from '@camera.ui/logger';
import type { AuthApi, ConnectionOptions } from '../types.js';

export interface DirectModeBundle {
  readonly options: ConnectionOptions;
  readonly api: AuthApi;
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

export function buildDirectMode(endpointUrl: string, logger?: Logger): DirectModeBundle {
  const api = createAuthApi();
  const network = createNetworkAdapters();
  const refresh = createRefresh(api);

  const options: ConnectionOptions = {
    adapters: {
      storage: createStorageAdapter(),
      visibilitySource: createVisibilitySource(),
      networkSource: network.networkSource,
      networkChangeSource: network.networkChangeSource,
      wakeSource: createWakeSource(),
    },
    callbacks: {
      discover: createDiscoverDirect(endpointUrl),
      probe: createProbe(api, refresh),
      refresh: refresh.refresh,
      bindRefresh: refresh.bindCoordination,
      onConnectionReset: refresh.clear,
      ownsEndpoint: (url) => sameOrigin(url, instanceOverride.value ?? endpointUrl),
    },
    transportOptions: isProxySignIn() ? { http: { authorize: async () => {} } } : undefined,
    logger,
  };

  return { options, api };
}
