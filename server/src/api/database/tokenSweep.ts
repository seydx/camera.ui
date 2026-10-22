import type { Database as DB } from 'lmdb';
import type { DBToken } from '../types/index.js';

type Tokens = DB<DBToken, string>;

export async function sweepExpiredTokens(db: Tokens, now = Date.now()): Promise<number> {
  const expired: string[] = [];
  for (const { key, value } of db.getRange()) {
    if (isExpiredToken(value, now)) expired.push(key);
  }
  if (!expired.length) return 0;

  return db.transaction(() => {
    let removed = 0;
    for (const key of expired) {
      const row = db.get(key);
      if (!row || !isExpiredToken(row, now)) continue;
      db.remove(key);
      removed++;
    }
    return removed;
  });
}

export function isExpiredToken(row: DBToken, now = Date.now()): boolean {
  if (row.type === 'api' || !(row.refresh_token_expires_at > 0)) return false;
  return Math.max(row.refresh_token_expires_at, row.access_token_expires_at ?? 0) < now;
}
