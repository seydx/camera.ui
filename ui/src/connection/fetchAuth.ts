import { isProxySignIn } from '@/common/base.js';

import { getConnection } from './instance.js';

export type FetchAuthorizer = () => Promise<Record<string, string>>;

let authorizer: FetchAuthorizer | null = null;

export function setFetchAuthorizer(fn: FetchAuthorizer | null): void {
  authorizer = fn;
}

export function bearer(access: string | undefined): Record<string, string> {
  return access && !isProxySignIn() ? { Authorization: `Bearer ${access}` } : {};
}

export async function fetchAuthHeaders(): Promise<Record<string, string>> {
  if (authorizer) return authorizer();
  return bearer(getConnection().target.value?.tokens?.access);
}
