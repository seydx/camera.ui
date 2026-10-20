import { sleep } from '@camera.ui/common/utils';
import { isProbeFailure, makeProbeFailure } from '@camera.ui/transport';

import { homeOrigin } from '@/common/base.js';

import type { Endpoint, Tokens } from '@camera.ui/transport';
import type { NavLayoutSettings } from '@shared/types';
import type { Connection, LoginUserData, ProbeFn } from './types.js';

const EMBED_TOKEN_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const ME_RETRIES = 3;
const ME_RETRY_DELAY_MS = 300;

let userSink: ((user: LoginUserData) => void) | undefined;

async function fetchEmbedUser(url: string, retries = ME_RETRIES, signal?: AbortSignal): Promise<EmbedUser | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return (await res.json()) as EmbedUser;
      if (res.status === 401 || res.status === 403) return null;
    } catch {
      // network-level failure, fall through to retry
    }
    if (attempt < retries - 1) await sleep(ME_RETRY_DELAY_MS);
  }
  return null;
}

function isEmbedUser(user: EmbedUser | null): user is EmbedUser {
  return !!user?._id && !!user.username && !!user.role;
}

function embedTokens(): Tokens {
  return { access: 'embed', accessExpiresAt: Date.now() + EMBED_TOKEN_TTL_MS };
}

function loginUser(user: EmbedUser): LoginUserData {
  return {
    _id: user._id,
    username: user.username,
    role: user.role,
    firstLogin: user.firstLogin,
    avatar: user.avatar,
    navLayout: user.navLayout,
  };
}

interface EmbedUser {
  _id?: string;
  username?: string;
  role?: string;
  firstLogin?: boolean;
  avatar?: string;
  navLayout?: NavLayoutSettings | null;
}

export interface ConsumeEmbedSessionOptions {
  readonly onUser?: (user: LoginUserData) => void;
}

export async function consumeEmbedSession(connection: Connection, options: ConsumeEmbedSessionOptions = {}): Promise<boolean> {
  userSink = options.onUser;
  const base = homeOrigin();

  const user = await fetchEmbedUser(`${base}/api/auth/me`);
  if (!isEmbedUser(user)) return false;

  const endpoint: Endpoint = { url: base, mode: 'direct-lan', priority: 0 };
  await connection.seedAndRetry({ endpoint, tokens: embedTokens() }, 'home');

  options.onUser?.(loginUser(user));
  return true;
}

export function createEmbedProbe(probe: ProbeFn): ProbeFn {
  return async (ctx) => {
    try {
      return await probe(ctx);
    } catch (err) {
      if (!isProbeFailure(err) || err.kind !== 'needs-auth') throw err;
      const user = await fetchEmbedUser(`${ctx.endpoint.url}/api/auth/me`, 1, ctx.signal);
      if (!isEmbedUser(user)) throw makeProbeFailure('transient', 'embed session not ready');
      userSink?.(loginUser(user));
      return ctx.lastTokens?.access === 'embed' ? ctx.lastTokens : embedTokens();
    }
  };
}
