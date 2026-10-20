import { DeviceStorage } from './storage.js';

import type { RPCClient } from '@camera.ui/rpc';
import type { JsonSchema, PluginInfo } from '@camera.ui/sdk';
import type { PluginConfigDb } from './configDb.js';
import type { PluginAPI } from './pluginApi.js';

function sensorStorageKey(sensorId: string): string {
  return `sensor:${sensorId}`;
}

export class StorageController {
  #api: PluginAPI;
  #proxy: RPCClient;
  #plugin: PluginInfo;
  #pluginDb: PluginConfigDb;
  #storages = new Map<string, DeviceStorage<any>>();

  constructor(api: PluginAPI, proxy: RPCClient, plugin: PluginInfo, pluginDb: PluginConfigDb) {
    this.#api = api;
    this.#proxy = proxy;
    this.#plugin = plugin;
    this.#pluginDb = pluginDb;
  }

  public createCameraStorage<T extends Record<string, any> = Record<string, any>>(cameraId: string, schemas: JsonSchema[] = []): DeviceStorage<T> {
    let cameraStorage = this.#storages.get(cameraId);

    if (!cameraStorage) {
      cameraStorage = new DeviceStorage<T>(this.#api, this.#proxy, this.#plugin, this.#pluginDb, { kind: 'camera', cameraId }, schemas);
      this.#storages.set(cameraId, cameraStorage);
    } else if (schemas.length) {
      cameraStorage.updateSchema(schemas);
    }

    return cameraStorage as DeviceStorage<T>;
  }

  public createPluginStorage<T extends Record<string, any> = Record<string, any>>(schemas: JsonSchema[] = []): DeviceStorage<T> {
    let pluginStorage = this.#storages.get('storage');

    if (!pluginStorage) {
      pluginStorage = new DeviceStorage<T>(this.#api, this.#proxy, this.#plugin, this.#pluginDb, { kind: 'plugin' }, schemas);
      this.#storages.set('storage', pluginStorage);
    } else if (schemas.length) {
      pluginStorage.updateSchema(schemas);
    }

    return pluginStorage as DeviceStorage<T>;
  }

  public getCameraStorage<T extends Record<string, any> = Record<string, any>>(deviceId: string): DeviceStorage<T> | undefined {
    return this.#storages.get(deviceId) as DeviceStorage<T> | undefined;
  }

  public getPluginStorage<T extends Record<string, any> = Record<string, any>>(): DeviceStorage<T> | undefined {
    return this.#storages.get('storage') as DeviceStorage<T> | undefined;
  }

  public createSensorStorage<T extends Record<string, any> = Record<string, any>>(pluginId: string, sensorId: string, schemas: JsonSchema[] = []): DeviceStorage<T> {
    const storageKey = sensorStorageKey(sensorId);
    let storage = this.#storages.get(storageKey);

    if (!storage) {
      storage = new DeviceStorage<T>(this.#api, this.#proxy, this.#plugin, this.#pluginDb, { kind: 'sensor', pluginId, sensorId }, schemas, sensorId);
      this.#storages.set(storageKey, storage);
    } else if (schemas.length) {
      storage.updateSchema(schemas);
    }

    return storage as DeviceStorage<T>;
  }

  public getSensorStorage<T extends Record<string, any> = Record<string, any>>(sensorId: string): DeviceStorage<T> | undefined {
    return this.#storages.get(sensorStorageKey(sensorId)) as DeviceStorage<T> | undefined;
  }

  public async createStorage(type: 'camera', deviceId: string): Promise<DeviceStorage<any>>;
  public async createStorage(type: 'plugin'): Promise<DeviceStorage<any>>;
  public async createStorage(type: 'sensor', pluginId: string, sensorId: string): Promise<DeviceStorage<any>>;
  public async createStorage(type: 'camera' | 'plugin' | 'sensor', deviceIdOrPluginId?: string, sensorId?: string): Promise<DeviceStorage<any>> {
    let storage: DeviceStorage<any> | undefined;

    if (type === 'camera') {
      if (!deviceIdOrPluginId) {
        throw new Error('deviceId is required for camera storage creation');
      }
      storage = this.createCameraStorage(deviceIdOrPluginId);
    } else if (type === 'sensor') {
      if (!deviceIdOrPluginId || !sensorId) {
        throw new Error('pluginId and sensorId are required for sensor storage creation');
      }
      storage = this.createSensorStorage(deviceIdOrPluginId, sensorId);
    } else {
      storage = this.createPluginStorage();
    }

    await storage.registerStorage();
    return storage;
  }

  public async releaseCameraStorage(cameraId: string): Promise<void> {
    await this.#storages.get(cameraId)?.unregisterStorage();
  }

  /** Internal method to close all storages */
  public async close(): Promise<void> {
    const storages = Array.from(this.#storages.values());
    // saves share one config document and run in order, the handler drains overlap
    for (const storage of storages) {
      await storage.save().catch((error) => this.#api.logger.error('store: close save failed:', error));
    }
    await Promise.all(storages.map((storage) => storage.unregisterStorage().catch((error) => this.#api.logger.error('store: close unregister failed:', error))));
  }
}
