import { join } from 'node:path';

import { NamespaceManager } from '../rpc/namespaces.js';
import { PluginStoreFile } from './store/pluginStoreFile.js';

import type { RPCClient } from '@camera.ui/rpc';

export const STALE_INSTANCE = 'STALE_INSTANCE';

export interface ConfigStoreMeta {
  instanceId?: string;
  madeBy?: string;
}

export interface PluginConfigStoreRPC {
  get(): Promise<Record<string, any>>;
  load(): Promise<{ doc: Record<string, any>; rev?: string }>;
  put(config: Record<string, any>, meta?: ConfigStoreMeta): Promise<{ rev?: string } | undefined>;
  putIfRev(config: Record<string, any>, baseRev: string, meta?: ConfigStoreMeta): Promise<{ applied: boolean; rev?: string }>;
}

export class PluginConfigStore implements PluginConfigStoreRPC {
  private store?: PluginStoreFile;
  private closeHandler?: () => Promise<void>;
  private lastPut?: { instanceId?: string; rev?: string };

  constructor(
    private readonly pluginId: string,
    private readonly storagePath: string,
    private readonly accepts: (instanceId: string) => Promise<boolean>,
  ) {}

  public async register(proxy: RPCClient): Promise<void> {
    this.store = new PluginStoreFile(join(this.storagePath, 'volume'));
    await this.store.open();

    const namespaces = NamespaceManager.pluginNamespaces(this.pluginId);
    this.closeHandler = await proxy.registerHandler(
      namespaces.pluginConfigStoreRpc,
      {
        get: () => this.get(),
        load: () => this.load(),
        put: (config: Record<string, any>, meta?: ConfigStoreMeta) => this.put(config, meta),
        putIfRev: (config: Record<string, any>, baseRev: string, meta?: ConfigStoreMeta) => this.putIfRev(config, baseRev, meta),
      },
      { withoutDecorators: true },
    );
  }

  public async close(): Promise<void> {
    await this.closeHandler?.();
    this.closeHandler = undefined;
    await this.store?.close();
    this.store = undefined;
  }

  public async get(): Promise<Record<string, any>> {
    return this.open().get();
  }

  public async load(): Promise<{ doc: Record<string, any>; rev?: string }> {
    const store = this.open();
    return { doc: store.get(), rev: await store.rev() };
  }

  public async put(config: Record<string, any>, meta?: ConfigStoreMeta): Promise<{ rev?: string }> {
    await this.fence(meta);
    const store = this.open();
    await store.put(config);
    const rev = await store.rev();
    this.lastPut = { instanceId: meta?.instanceId, rev };
    return { rev };
  }

  public async putIfRev(config: Record<string, any>, baseRev: string, meta?: ConfigStoreMeta): Promise<{ applied: boolean; rev?: string }> {
    await this.fence(meta);
    const store = this.open();
    const rev = await store.rev();
    const ownLateSave = !!meta?.madeBy && this.lastPut?.instanceId === meta.madeBy && this.lastPut.rev === rev;
    if (rev !== baseRev && !ownLateSave) return { applied: false, rev };
    await store.put(config);
    const applied = await store.rev();
    this.lastPut = { instanceId: meta?.instanceId, rev: applied };
    return { applied: true, rev: applied };
  }

  private open(): PluginStoreFile {
    if (!this.store) {
      // returning {} would boot the plugin with defaults over its real data
      throw new Error(`store: config store for ${this.pluginId} is closed`);
    }
    return this.store;
  }

  private async fence(meta?: ConfigStoreMeta): Promise<void> {
    if (meta?.instanceId && !(await this.accepts(meta.instanceId))) {
      throw new Error(`${STALE_INSTANCE}: instance ${meta.instanceId} no longer runs this plugin`);
    }
  }
}
