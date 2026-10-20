import { applyNativeHttp } from '@camera.ui/transport/transports/nativeHttp';

import { isPinnedUrl } from './certTrust.js';
import { isCapacitor } from './runtime.js';

import type { AxiosInstance } from 'axios';

export function installNativeHttp(client: AxiosInstance): void {
  applyNativeHttp(client, {
    enabled: isCapacitor,
    // the native session only knows the system trust store
    exclude: isPinnedUrl,
    // never set Accept-Encoding, Android only unzips when HttpURLConnection negotiated gzip itself
    request: async (init) => {
      const { CapacitorHttp } = await import('@capacitor/core');
      return CapacitorHttp.request(init);
    },
  });
}
