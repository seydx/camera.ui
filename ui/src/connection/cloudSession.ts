import type { CloudSession, CloudSessionHolder } from './types.js';

export function createCloudSession(initial?: CloudSession | null): CloudSessionHolder {
  const state = shallowRef<CloudSession | null>(initial ?? null);

  function set(next: CloudSession): void {
    state.value = next;
  }

  function patch(partial: Partial<CloudSession>): void {
    const current = state.value;
    if (!current) {
      return;
    }
    state.value = { ...current, ...partial };
  }

  function clear(): void {
    state.value = null;
  }

  return { state, set, patch, clear };
}

const PROXY_GRACE_MS = 60_000;

export function proxyTokenLooksValid(session: CloudSession, now = Date.now()): boolean {
  if (!session.proxyTokenExpiresAt) return true;
  return session.proxyTokenExpiresAt > now + PROXY_GRACE_MS;
}

export function proxyRefreshLooksValid(session: CloudSession, now = Date.now()): boolean {
  if (!session.proxyRefreshToken) return false;
  if (!session.proxyRefreshTokenExpiresAt) return true;
  return session.proxyRefreshTokenExpiresAt > now;
}
