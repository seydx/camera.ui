import { isProbeFailure, makeProbeFailure } from '@camera.ui/transport';
import axios from 'axios';

import { isCancellationError } from '@/common/utils.js';

import type { ProbeContext, Tokens } from '@camera.ui/transport';
import type { AuthApi, ProbeFn } from '../types.js';
import type { RefreshCoordinator } from './refresh.js';

const PROXY_RELOAD_FLAG = 'cui-proxy-login-reload';

async function redirectedByLoginProxy(endpoint: string, signal: AbortSignal): Promise<boolean> {
  try {
    if (new URL(endpoint).origin !== window.location.origin) return false;
    const response = await fetch(`${endpoint}/api/auth/check`, { redirect: 'manual', cache: 'no-store', signal });
    return response.type === 'opaqueredirect';
  } catch {
    return false;
  }
}

function reloadForProxyLogin(): boolean {
  try {
    if (sessionStorage.getItem(PROXY_RELOAD_FLAG)) return false;
    sessionStorage.setItem(PROXY_RELOAD_FLAG, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

function isLockWaitTimeout(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

function clearProxyReload(): void {
  try {
    sessionStorage.removeItem(PROXY_RELOAD_FLAG);
  } catch {
    // ignore
  }
}

export function createProbe(api: AuthApi, refresh: RefreshCoordinator): ProbeFn {
  return async (ctx: ProbeContext): Promise<Tokens> => {
    const endpoint = ctx.endpoint.url;
    const accessToken = ctx.lastTokens?.access ?? '';

    try {
      await api.authCheck(endpoint, accessToken, ctx.signal);
      clearProxyReload();
      if (!ctx.lastTokens?.access) throw makeProbeFailure('needs-auth', 'no tokens');
      return ctx.lastTokens;
    } catch (err) {
      // own failures pass through, the fallback would relabel them transient and trap the tab offline
      if (isProbeFailure(err)) throw err;
      if (ctx.signal.aborted) throw err;
      if (isCancellationError(err)) throw makeProbeFailure('aborted', 'request canceled');
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;

      if (typeof status === 'number') clearProxyReload();
      else if ((await redirectedByLoginProxy(endpoint, ctx.signal)) && reloadForProxyLogin()) {
        throw makeProbeFailure('transient', 'login proxy redirect, reloading');
      }

      // any HTTP answer means reachable, network failures stay transient so dead endpoints lose the race
      if (!ctx.lastTokens?.access) {
        if (typeof status === 'number') throw makeProbeFailure('needs-auth', 'no tokens');
        throw makeProbeFailure('transient', err instanceof Error ? err.message : 'auth/check failed');
      }

      if (status === 401 && ctx.lastTokens.refresh) {
        try {
          const freshTokens = await refresh.getFreshTokens({ endpoint, refreshToken: ctx.lastTokens.refresh, base: ctx.lastTokens, signal: ctx.signal });
          return { ...ctx.lastTokens, ...freshTokens };
        } catch (refreshErr) {
          if (ctx.signal.aborted) throw refreshErr;
          if (isLockWaitTimeout(refreshErr)) throw makeProbeFailure('transient', 'refresh lock not granted in time');
          if (isCancellationError(refreshErr)) throw makeProbeFailure('aborted', 'refresh canceled');
          const refreshStatus = axios.isAxiosError(refreshErr) ? refreshErr.response?.status : undefined;
          if (refreshStatus === 401 || refreshStatus === 403) {
            throw makeProbeFailure('needs-auth', 'refresh rejected');
          }
          throw makeProbeFailure('transient', refreshErr instanceof Error ? refreshErr.message : 'refresh failed');
        }
      }

      if (status === 401 || status === 403) {
        throw makeProbeFailure('needs-auth', 'tokens expired');
      }
      throw makeProbeFailure('transient', err instanceof Error ? err.message : 'auth/check failed');
    }
  };
}
