import { isCapacitor } from '@/connection/index.js';

export function registerDownloadCleanup(): void {
  if (!isCapacitor) return;
  Promise.all([import('@capacitor/app'), import('@/utils/cacheFile.js')]).then(([{ App }, { clearDownloads, sweepDownloads }]) => {
    clearDownloads();
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) sweepDownloads();
    });
  });
}
