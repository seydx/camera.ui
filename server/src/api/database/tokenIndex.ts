import type { Database as DB } from 'lmdb';
import type { DBToken } from '../types/index.js';

type Tokens = DB<DBToken, string>;

const indexes = new WeakMap<Tokens, TokenIndex>();

export class TokenIndex {
  private ids = new Map<string, string[]>();
  private byRow = new Map<string, string[]>();

  constructor(private db: Tokens) {
    for (const { key, value } of db.getRange()) this.track(key, value);
    this.hook();
  }

  public rows(token: string): DBToken[] {
    const rows: DBToken[] = [];
    for (const id of this.ids.get(token) ?? []) {
      const row = this.db.get(id);
      if (row && tokensOf(row).includes(token)) rows.push(row);
    }
    return rows;
  }

  private hook(): void {
    const db = this.db;
    const put = db.put.bind(db) as (...args: unknown[]) => Promise<boolean>;
    const remove = db.remove.bind(db) as (...args: unknown[]) => Promise<boolean>;
    const clearAsync = db.clearAsync.bind(db);
    const clearSync = db.clearSync.bind(db);

    db.put = (id: string, row: DBToken, ...rest: unknown[]) => {
      this.track(id, row);
      return put(id, row, ...rest);
    };
    db.remove = (id: string, ...rest: unknown[]) => {
      this.track(id, undefined);
      return remove(id, ...rest);
    };
    db.clearAsync = () => {
      this.reset();
      return clearAsync();
    };
    db.clearSync = () => {
      this.reset();
      clearSync();
    };
  }

  private track(id: string, row: DBToken | undefined): void {
    const next = row ? tokensOf(row) : [];

    for (const token of this.byRow.get(id) ?? []) {
      if (!next.includes(token)) this.unlink(token, id);
    }
    for (const token of next) this.link(token, id);

    if (next.length) this.byRow.set(id, next);
    else this.byRow.delete(id);
  }

  private link(token: string, id: string): void {
    const ids = this.ids.get(token);
    if (!ids) this.ids.set(token, [id]);
    else if (!ids.includes(id)) ids.push(id);
  }

  private unlink(token: string, id: string): void {
    const ids = this.ids.get(token)?.filter((other) => other !== id);
    if (ids?.length) this.ids.set(token, ids);
    else this.ids.delete(token);
  }

  private reset(): void {
    this.ids.clear();
    this.byRow.clear();
  }
}

export function tokenIndex(db: Tokens): TokenIndex {
  let index = indexes.get(db);
  if (!index) {
    index = new TokenIndex(db);
    indexes.set(db, index);
  }
  return index;
}

function tokensOf(row: DBToken): string[] {
  return [row.access_token, row.previous_access_token, row.refresh_token, row.previous_refresh_token].filter((token): token is string => !!token);
}
