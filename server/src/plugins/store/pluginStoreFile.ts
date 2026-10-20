import { unlinkSync } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { CoalescingWriter } from './coalescingWriter.js';
import { decodeEnvelope, envelopeRev } from './envelope.js';
import { upgradeStoreLayout } from './layout.js';
import { backupStoreFile, readStoreFile, removeOrphanedTmpFiles, writeStoreFile, writeStoreFileSync } from './storeFile.js';

export const STORE_FILE_NAME = 'store.cui';
const JOURNAL_SUFFIX = '.journal';

async function readIfExists(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export class PluginStoreFile {
  private readonly path: string;
  private readonly journalPath: string;
  private readonly writer: CoalescingWriter;
  private payload: Record<string, any> = {};
  private closed = true;
  private seq = 0;
  private journaled = false;
  private readonly detached = new Set<Promise<void>>();

  constructor(private readonly volumeDir: string) {
    this.path = join(volumeDir, STORE_FILE_NAME);
    this.journalPath = `${this.path}${JOURNAL_SUFFIX}`;
    this.writer = new CoalescingWriter((snapshot) => writeStoreFile(this.path, snapshot));
  }

  public async open(): Promise<void> {
    await mkdir(this.volumeDir, { recursive: true });
    await removeOrphanedTmpFiles(this.path);

    const journal = await this.readJournal();
    let payload = journal ?? (await readStoreFile(this.path));
    if (payload === undefined) {
      payload = {};
      await writeStoreFile(this.path, payload);
    } else if (journal) {
      await writeStoreFile(this.path, payload);
      await unlink(this.journalPath);
    }

    const upgraded = upgradeStoreLayout(payload);
    if (upgraded !== payload) {
      await writeStoreFile(this.path, upgraded);
    }

    this.payload = upgraded;
    await backupStoreFile(this.path);
    this.closed = false;
  }

  public get(): Record<string, any> {
    return this.payload;
  }

  public async put(payload: Record<string, any>): Promise<void> {
    this.assertOpen();
    this.payload = payload;
    const seq = ++this.seq;
    if (this.journaled) {
      try {
        this.writeJournal(payload);
      } catch {
        // the store file write below still carries it
      }
    }
    await this.persist(payload, seq);
  }

  public putSync(payload: Record<string, any>): void {
    this.assertOpen();
    this.payload = payload;
    const seq = ++this.seq;
    try {
      this.writeJournal(payload);
    } finally {
      // a failed store write keeps the journal for the next open
      const persisting = this.persist(payload, seq).catch(() => {});
      this.detached.add(persisting);
      persisting.then(() => this.detached.delete(persisting));
    }
  }

  public async close(): Promise<void> {
    this.closed = true;
    await Promise.all(this.detached);
    await this.writer.idle();
  }

  public async rev(): Promise<string | undefined> {
    await this.writer.idle();
    const buf = await readIfExists(this.path);
    return buf ? envelopeRev(buf) : undefined;
  }

  private assertOpen(): void {
    if (this.closed) {
      // a silent no-op would lose writes during shutdown
      throw new Error(`store: put on closed store ${this.path}`);
    }
  }

  private async persist(payload: Record<string, any>, seq: number): Promise<void> {
    await this.writer.write(payload);
    if (this.journaled && seq === this.seq) {
      this.removeJournal();
    }
  }

  private writeJournal(payload: Record<string, any>): void {
    try {
      writeStoreFileSync(this.journalPath, payload);
      this.journaled = true;
    } catch (error) {
      // an older journal must not outlive a newer state
      this.removeJournal();
      throw error;
    }
  }

  private removeJournal(): void {
    try {
      unlinkSync(this.journalPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return;
      }
    }
    this.journaled = false;
  }

  private async readJournal(): Promise<Record<string, any> | undefined> {
    const buf = await readIfExists(this.journalPath);
    if (!buf) {
      return undefined;
    }
    try {
      return decodeEnvelope(buf);
    } catch {
      // rename rules out a torn journal, a damaged one yields to the store file
      await unlink(this.journalPath).catch(() => {});
      return undefined;
    }
  }
}
