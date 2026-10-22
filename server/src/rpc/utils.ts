import { createHmac, randomBytes } from 'node:crypto';

import type { AuthConfig } from './interfaces/config.js';

export function generateCredentials(): AuthConfig {
  const userBytes = randomBytes(8);
  const passwordBytes = randomBytes(16);

  const user = userBytes
    .toString('base64')
    .replace(/[+/=@:]/g, '')
    .slice(0, 8);
  const password = passwordBytes.toString('base64').replace(/[+/=@:]/g, '');

  return { user, password };
}

export function workerConnId(agentId: string, secret: string): string {
  return createHmac('sha256', secret).update(agentId).digest('hex').slice(0, 32);
}

export async function safeAsync<R>(promise?: Promise<R>): Promise<R | null> {
  if (!promise) return null;
  try {
    return await promise;
  } catch {
    return null;
  }
}
