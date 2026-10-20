import { getBootResult } from '@/connection/bootApp.js';
import { bounceToCloudFrontend } from '@/connection/cloudHandoff.js';
import { getConnection } from '@/connection/instance.js';
import { isCapacitor } from '@/connection/runtime.js';

import { resolveAxiosClient } from './client.js';
import { isRemoteDisabledError, isServerGoneError, isTunnelPendingError, readErrorBody } from './errors.js';
import { scopeRequestsToSession } from './sessionScope.js';

import type { ProxyMintResult } from '@/connection/types.js';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const MAX_TUNNEL_RETRIES = 3;
const DEFAULT_RETRY_AFTER_S = 5;

interface RetryConfig extends InternalAxiosRequestConfig {
  _proxyRetry?: boolean;
  _tunnelRetries?: number;
}

let remintInflight: Promise<string | null> | null = null;

function tryRemintProxy(): Promise<string | null> {
  if (remintInflight) return remintInflight;
  remintInflight = doRemintProxy().finally(() => {
    remintInflight = null;
  });
  return remintInflight;
}

async function doRemintProxy(): Promise<string | null> {
  const boot = getBootResult();
  if (boot.mode !== 'cloud' || !boot.cloudSession) return null;

  const session = boot.cloudSession.state.value;
  if (!session) return null;

  let minted: ProxyMintResult | null = null;
  if (session.proxyRefreshToken && session.cloudApiBase) {
    try {
      minted = await boot.api.refreshProxy(session.cloudApiBase, session.proxyRefreshToken);
    } catch {
      // fall through to L1 path
    }
  }

  if (!minted && isCapacitor && session.serverId && session.cloudApiBase) {
    try {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      const l1 = await SecureStorage.get('accessToken');
      if (typeof l1 === 'string') {
        minted = await boot.api.remintProxyFromL1(session.cloudApiBase, session.serverId, l1);
      }
    } catch {
      // fall through to null
    }
  }

  if (!minted) return null;

  boot.cloudSession.set({
    ...session,
    proxyUrl: minted.proxyUrl,
    proxyToken: minted.proxyToken,
    proxyRefreshToken: minted.proxyRefreshToken ?? session.proxyRefreshToken,
    proxyTokenExpiresAt: minted.proxyTokenExpiresAt,
    proxyRefreshTokenExpiresAt: minted.proxyRefreshTokenExpiresAt ?? session.proxyRefreshTokenExpiresAt,
  });

  // the kernel target and its persisted copy carry the proxy session too
  const kernel = boot.connection.kernel;
  const phase = kernel.phase;
  const live = phase.kind === 'online' ? phase.target : null;
  if (live) {
    kernel.dispatch({
      type: 'TOKENS_REFRESHED',
      tokens: {
        ...live.tokens,
        proxySession: minted.proxyToken,
        proxySessionExpiresAt: minted.proxyTokenExpiresAt,
        proxyRefresh: minted.proxyRefreshToken ?? live.tokens.proxyRefresh,
      },
    });
  }

  return minted.proxyToken;
}

export function installApiErrorHandling(): void {
  const client = resolveAxiosClient();
  scopeRequestsToSession(client, getConnection().kernel);

  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;

      const body = readErrorBody(error);
      const isProxySessionExpired = error.response?.status === 401 && body?.message === 'Session expired' && typeof body.redirect === 'string';
      if (isProxySessionExpired && config && !config._proxyRetry) {
        const fresh = await tryRemintProxy();
        if (fresh) {
          config._proxyRetry = true;
          if (config.headers) {
            (config.headers as Record<string, string>)['X-Proxy-Session'] = fresh;
          }
          return client(config);
        }
        return Promise.reject(error);
      }

      if (isServerGoneError(error)) {
        await bounceToCloudFrontend();
        return Promise.reject(error);
      }

      if (isRemoteDisabledError(error)) {
        await bounceToCloudFrontend();
        return Promise.reject(error);
      }

      if (isTunnelPendingError(error) && config) {
        const attempts = config._tunnelRetries ?? 0;
        config._tunnelRetries = attempts + 1;
        if (attempts >= MAX_TUNNEL_RETRIES) return Promise.reject(error);

        const retryAfterHeader = error.response?.headers?.['retry-after'];
        const retryAfterS = Number.parseInt(retryAfterHeader ?? '', 10) || DEFAULT_RETRY_AFTER_S;
        await new Promise((resolve) => setTimeout(resolve, retryAfterS * 1000));
        return client(config);
      }

      return Promise.reject(error);
    },
  );
}
