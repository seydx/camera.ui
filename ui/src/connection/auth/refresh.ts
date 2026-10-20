import type { Tokens } from '@camera.ui/transport';
import type { AuthApi, RefreshCoordination, RefreshFn } from '../types.js';

const REUSE_GRACE_MS = 15_000;

export interface RefreshInput {
  readonly endpoint: string;
  readonly refreshToken: string | undefined;
  readonly base?: Tokens;
  readonly signal?: AbortSignal;
}

export interface RefreshCoordinator {
  readonly refresh: RefreshFn;
  readonly getFreshTokens: (input: RefreshInput) => Promise<Tokens>;
  readonly bindCoordination: (co: RefreshCoordination) => void;
  readonly clear: () => void;
}

export function createRefresh(api: AuthApi): RefreshCoordinator {
  let inflight: Promise<Tokens> | null = null;
  let cached: Tokens | null = null;
  let cachedEndpoint = '';
  let coordination: RefreshCoordination | null = null;
  let rejected: string | undefined;

  function reusable(tokens: Tokens): boolean {
    return tokens.access !== rejected && !!tokens.accessExpiresAt && tokens.accessExpiresAt > Date.now() + REUSE_GRACE_MS;
  }

  async function doRefresh(endpoint: string, refreshToken: string | undefined, base: Tokens | undefined, signal?: AbortSignal): Promise<Tokens> {
    if (cachedEndpoint === endpoint && cached && reusable(cached)) return cached;
    if (inflight) return inflight;

    // another tab may have rotated the refresh token while this one waited for the lock
    const latest: Tokens | null = coordination?.getLatestTokens?.() ?? null;
    if (latest && reusable(latest)) {
      cached = latest;
      cachedEndpoint = endpoint;
      return latest;
    }
    const effectiveRefresh = latest?.refresh ?? refreshToken;
    if (!effectiveRefresh) throw new Error('no refresh token available');

    inflight = (async () => {
      const result = await api.refreshDirect(endpoint, effectiveRefresh, signal);
      const merged: Tokens = { ...base, ...result.tokens };
      cached = merged;
      cachedEndpoint = endpoint;
      return merged;
    })();
    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  }

  async function coalesced(endpoint: string, refreshToken: string | undefined, base: Tokens | undefined, signal?: AbortSignal): Promise<Tokens> {
    // cheap pre-check, the authoritative one repeats inside the lock
    if (cachedEndpoint === endpoint && cached && reusable(cached)) return cached;
    if (inflight) return inflight;
    const lock = coordination?.acquireLock;
    if (lock) return lock(() => doRefresh(endpoint, refreshToken, base, signal));
    return doRefresh(endpoint, refreshToken, base, signal);
  }

  return {
    refresh: (target, reason) => {
      if (reason === 'auth-error') rejected = target.tokens.access;
      // no lock: tokenLifecycle already holds it and navigator.locks is not reentrant
      return doRefresh(target.endpoint.url, target.tokens.refresh, target.tokens);
    },
    getFreshTokens: ({ endpoint, refreshToken, base, signal }) => {
      // the probe lands here after a 401, its access token was just rejected
      if (base?.access) rejected = base.access;
      return coalesced(endpoint, refreshToken, base, signal);
    },
    bindCoordination: (co) => {
      coordination = co;
    },
    clear: () => {
      cached = null;
      cachedEndpoint = '';
      inflight = null;
    },
  };
}
