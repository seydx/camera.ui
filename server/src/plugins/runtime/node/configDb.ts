import { isNoRespondersError } from '@camera.ui/rpc';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { STALE_INSTANCE } from '../../config-store.js';

import type { Logger } from '@camera.ui/common/logger';
import type { Promisify } from '@camera.ui/rpc';
import type { PluginConfigStoreRPC } from '../../config-store.js';
import type { PluginStoreFile } from '../../store/pluginStoreFile.js';

const FLUSH_DELAY_MS = 200;
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10_000];
const STOP_FLUSH_MS = 5000;
const SPILL_FILE = '.pending-config.json';
const SPILL_MAX_AGE_MS = 24 * 60 * 60_000;

interface Spill {
  instanceId?: string;
  baseRev?: string;
  doc: Record<string, any>;
  at: number;
}

export interface PluginConfigDb {
  get(key: 'config'): Record<string, any> | undefined;
  put(key: 'config', value: Record<string, any>): Promise<unknown>;
  putSync(key: 'config', value: Record<string, any>): void;
  flush?(): Promise<unknown>;
  close?(): Promise<unknown>;
}

export class LocalPluginConfigDb implements PluginConfigDb {
  constructor(private readonly store: PluginStoreFile) {}

  public get(_key: 'config'): Record<string, any> {
    return this.store.get();
  }

  public async put(_key: 'config', value: Record<string, any>): Promise<void> {
    await this.store.put(value);
  }

  public putSync(_key: 'config', value: Record<string, any>): void {
    this.store.putSync(value);
  }

  public async close(): Promise<void> {
    await this.store.close();
  }
}

export class RemotePluginConfigDb implements PluginConfigDb {
  #cache: Record<string, any> = {};
  #rev?: string;
  #dirty = false;
  #attempt = 0;
  #timer?: NodeJS.Timeout;
  #flushing?: Promise<void>;
  #closed = false;
  readonly #spillPath: string;

  constructor(
    private readonly store: Promisify<PluginConfigStoreRPC>,
    private readonly probe: Promisify<PluginConfigStoreRPC>,
    storagePath: string,
    private readonly instanceId: string | undefined,
    private readonly logger: Logger,
  ) {
    this.#spillPath = join(storagePath, SPILL_FILE);
  }

  public async init(): Promise<void> {
    try {
      mkdirSync(dirname(this.#spillPath), { recursive: true });
    } catch (error) {
      this.logger.debug('Could not create the storage folder for unsaved config changes:', error);
    }
    await this.replaySpill();
    try {
      const loaded = await this.probe.load();
      this.#cache = loaded?.doc ?? {};
      this.#rev = loaded?.rev;
    } catch (error) {
      if (!isNoRespondersError(error)) {
        throw error;
      }
      this.#cache = (await this.store.get()) ?? {};
      this.#rev = undefined;
    }
  }

  public get(_key: 'config'): Record<string, any> {
    return this.#cache;
  }

  public async put(key: 'config', value: Record<string, any>): Promise<void> {
    this.putSync(key, value);
  }

  public putSync(_key: 'config', value: Record<string, any>): void {
    this.#cache = value;
    this.#dirty = true;
    this.writeSpill();
    this.schedule(FLUSH_DELAY_MS);
  }

  public async flush(): Promise<void> {
    await this.#flushing;
    if (!this.#dirty) {
      return;
    }
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#flushing = this.save().finally(() => {
      this.#flushing = undefined;
    });
    await this.#flushing;
    if (this.#dirty) {
      this.schedule(RETRY_DELAYS_MS[0]);
      throw new Error('the config change is not saved yet');
    }
  }

  public async close(): Promise<void> {
    this.#closed = true;
    clearTimeout(this.#timer);
    this.#timer = undefined;

    const last = (async () => {
      await this.#flushing;
      if (this.#dirty) {
        await this.save();
      }
    })();
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([last, new Promise<void>((resolve) => (timer = setTimeout(resolve, STOP_FLUSH_MS)))]);
    clearTimeout(timer);
  }

  private schedule(delayMs: number): void {
    if (this.#closed || this.#timer || this.#flushing) {
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#flushing = this.save().finally(() => {
        this.#flushing = undefined;
        if (this.#dirty) {
          this.schedule(this.#attempt > 0 ? RETRY_DELAYS_MS[Math.min(this.#attempt - 1, RETRY_DELAYS_MS.length - 1)] : FLUSH_DELAY_MS);
        }
      });
    }, delayMs);
  }

  private async save(): Promise<void> {
    const doc = this.#cache;
    this.#dirty = false;
    try {
      const result = await this.store.put(doc, { instanceId: this.instanceId });
      this.#rev = result?.rev;
      this.#attempt = 0;
      if (this.#dirty) {
        // a newer change arrived, its spill needs the new rev
        this.writeSpill();
      } else {
        this.removeSpill();
      }
    } catch (error) {
      if (String((error as Error)?.message).includes(STALE_INSTANCE)) {
        this.logger.warn(`Dropped a config change: instance ${this.instanceId} no longer runs the plugin`);
        this.removeSpill();
        return;
      }
      if (this.#attempt === 0) {
        const message = `Saving the config failed, retrying: ${(error as Error)?.message ?? error}`;
        // no responders: the master restarts, the change waits on disk
        if (isNoRespondersError(error)) {
          this.logger.debug(message);
        } else {
          this.logger.warn(message);
        }
      }
      this.#attempt++;
      this.#dirty = true;
    }
  }

  private async replaySpill(): Promise<void> {
    let spill: Spill;
    try {
      spill = JSON.parse(readFileSync(this.#spillPath, 'utf-8')) as Spill;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('Dropped an unreadable unsaved config change:', error);
        this.removeSpill();
      }
      return;
    }

    if (!spill.doc || Date.now() - spill.at > SPILL_MAX_AGE_MS) {
      this.logger.warn('Dropped an unsaved config change older than 24 h');
      this.removeSpill();
      return;
    }
    if (!spill.baseRev) {
      this.logger.warn('Dropped an unsaved config change made under an older camera.ui server');
      this.removeSpill();
      return;
    }

    try {
      const result = await this.probe.putIfRev(spill.doc, spill.baseRev, { instanceId: this.instanceId, madeBy: spill.instanceId });
      if (result?.applied) {
        this.logger.log('Restored a config change the last run did not save');
      } else {
        this.logger.warn(`Dropped an unsaved config change of the last run (instance ${spill.instanceId}), the config was saved in between`);
      }
    } catch (error) {
      if (isNoRespondersError(error)) {
        this.logger.warn('Dropped an unsaved config change, the camera.ui server is too old to take it');
      } else if (String((error as Error)?.message).includes(STALE_INSTANCE)) {
        this.logger.warn('Dropped an unsaved config change: this instance no longer runs the plugin');
      } else {
        // kept for the next start
        throw error;
      }
    }
    this.removeSpill();
  }

  private writeSpill(): void {
    const spill: Spill = { instanceId: this.instanceId, baseRev: this.#rev, doc: this.#cache, at: Date.now() };
    const tmp = `${this.#spillPath}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(spill));
      renameSync(tmp, this.#spillPath);
    } catch (error) {
      this.logger.debug('Could not write the unsaved config change to disk:', error);
    }
  }

  private removeSpill(): void {
    try {
      unlinkSync(this.#spillPath);
    } catch {
      // not there
    }
  }
}
