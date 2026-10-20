import { sleep } from '@camera.ui/common/utils';

import type { Logger } from '@camera.ui/common';

const CHECK_INTERVAL_MIN_MS = 3_000;
const CHECK_INTERVAL_MAX_MS = 60_000;
const CHECK_INTERVAL_GROWTH = 1.5;
const WARN_AFTER_MS = 120_000;
const MAX_WATCHERS = 4;

export type DnsAnswer = 'yes' | 'no' | 'unknown';

interface WatchHandle {
  cancelled: boolean;
}

export class UrlReadinessGate {
  private readyUrls = new Set<string>();
  private watchers = new Map<string, WatchHandle>();

  constructor(
    private logger: Logger,
    private onReady?: (url: string) => void,
  ) {}

  public isReady(url: string): boolean {
    return this.readyUrls.has(normalizeUrl(url));
  }

  public ensureReady(url: string): void {
    const normalized = normalizeUrl(url);
    if (this.readyUrls.has(normalized) || this.watchers.has(normalized)) return;

    if (this.watchers.size >= MAX_WATCHERS) {
      const [oldestUrl, oldestHandle] = this.watchers.entries().next().value!;
      oldestHandle.cancelled = true;
      this.watchers.delete(oldestUrl);
    }

    const handle: WatchHandle = { cancelled: false };
    this.watchers.set(normalized, handle);

    this.watch(normalized, handle).finally(() => {
      if (this.watchers.get(normalized) === handle) {
        this.watchers.delete(normalized);
      }
    });
  }

  public clear(): void {
    this.readyUrls.clear();
    for (const handle of this.watchers.values()) {
      handle.cancelled = true;
    }
    this.watchers.clear();
  }

  private async watch(url: string, handle: WatchHandle): Promise<void> {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      this.logger.warn('Remote URL is not a valid URL:', url);
      return;
    }

    // a too early lookup poisons the clients' negative DNS cache for minutes
    const startedAt = Date.now();
    let interval = CHECK_INTERVAL_MIN_MS;
    let warned = false;

    for (;;) {
      const dns = await publicDnsAnswer(hostname);
      if (handle.cancelled) return;

      // public DNS is the gate, the probe only counts when DoH itself is unreachable
      if (dns === 'yes' || (dns === 'unknown' && (await probeHealth(url)))) {
        if (handle.cancelled) return;
        this.readyUrls.add(url);
        this.logger.log('Remote URL is publicly reachable:', url);
        this.onReady?.(url);
        return;
      }
      if (handle.cancelled) return;

      if (!warned && Date.now() - startedAt >= WARN_AFTER_MS) {
        warned = true;
        this.logger.warn('Remote URL is still not publicly reachable, continuing to check in the background:', url);
      }

      await sleep(interval);
      if (handle.cancelled) return;
      interval = Math.min(interval * CHECK_INTERVAL_GROWTH, CHECK_INTERVAL_MAX_MS);
    }
  }
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    return new URL(trimmed).toString().replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export async function publicDnsAnswer(hostname: string): Promise<DnsAnswer> {
  const endpoints = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'];

  for (const endpoint of endpoints) {
    const a = await dohLookup(endpoint, hostname, 'A');
    if (a === undefined) continue;
    if (a === 'yes' || a === 'no') return a;

    // NOERROR without A records, the host may be IPv6-only
    const aaaa = await dohLookup(endpoint, hostname, 'AAAA');
    if (aaaa === undefined) continue;
    return aaaa === 'yes' ? 'yes' : 'no';
  }

  return 'unknown';
}

async function dohLookup(endpoint: string, hostname: string, type: 'A' | 'AAAA'): Promise<'yes' | 'no' | 'empty' | undefined> {
  try {
    const response = await fetch(`${endpoint}?name=${encodeURIComponent(hostname)}&type=${type}`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return undefined;

    const result = (await response.json()) as { Status?: number; Answer?: unknown[] };
    if (result.Status !== 0) return 'no';
    return Array.isArray(result.Answer) && result.Answer.length > 0 ? 'yes' : 'empty';
  } catch {
    return undefined;
  }
}

async function probeHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${normalizeUrl(url)}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
