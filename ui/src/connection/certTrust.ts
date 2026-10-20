import type { Endpoint } from '@camera.ui/transport';

export type CertTrustInstaller = (ca: string, hosts: readonly string[]) => Promise<void> | void;

let installer: CertTrustInstaller | null = null;
let pinnedHosts: ReadonlySet<string> = new Set();

export function setCertTrustInstaller(fn: CertTrustInstaller | null): void {
  installer = fn;
  if (!fn) pinnedHosts = new Set();
}

export function hasCertTrustInstaller(): boolean {
  return installer !== null;
}

export function isPinnedUrl(url: string): boolean {
  if (pinnedHosts.size === 0) return false;
  const host = hostOf(url);
  return host !== null && pinnedHosts.has(host);
}

export async function trustInternalCa(ca: string | undefined, pool: readonly Endpoint[]): Promise<void> {
  if (!installer || !ca) return;

  const hosts = [
    ...new Set(
      pool
        .filter((endpoint) => endpoint.mode === 'direct-lan')
        .map((endpoint) => hostOf(endpoint.url))
        .filter((host): host is string => Boolean(host)),
    ),
  ];
  if (hosts.length === 0) return;

  try {
    await installer(ca, hosts);
    pinnedHosts = new Set(hosts);
  } catch {
    // trust stays as it is, the race falls back to the external endpoints
  }
}

function hostOf(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    if (!hostname) return null;
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  } catch {
    return null;
  }
}
