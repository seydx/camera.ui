import { setCertTrustInstaller } from '@/connection/index.js';
import { isCapacitor } from '@/connection/runtime.js';

import type { CertTrustPayload } from '@/types/electron.js';

interface CertTrustPlugin {
  trust(options: { ca: string; hosts: string[] }): Promise<void>;
  clear(): Promise<void>;
}

const log = useLogger();

let plugin: CertTrustPlugin | null = null;

export function installCertTrustBridge(): void {
  const { electron } = useElectron();
  if (electron) {
    // older desktop builds reject the call, trustInternalCa swallows that
    setCertTrustInstaller(async (ca, hosts) => {
      await electron.invoke('cert-trust', { ca, hosts: [...hosts] } satisfies CertTrustPayload);
      log.debug(`[cert-trust] instance CA handed to the desktop app for ${hosts.length} host(s)`);
    });
    return;
  }

  if (!isCapacitor) return;

  setCertTrustInstaller(async (ca, hosts) => {
    if (!plugin) {
      const { registerPlugin } = await import('@capacitor/core');
      plugin = registerPlugin<CertTrustPlugin>('CertTrust');
    }
    await plugin.trust({ ca, hosts: [...hosts] });
    log.debug(`[cert-trust] instance CA trusted for ${hosts.length} host(s)`);
  });
}
