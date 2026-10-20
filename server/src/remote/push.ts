import { PushReceiver } from '@eneris/push-receiver';
import { EventEmitter } from 'node:events';

import { RemoteService } from '../api/services/remote.service.js';

import type { Logger } from '@camera.ui/common';
import type { Types } from '@eneris/push-receiver/dist/client.js';

const CONNECT_TIMEOUT_MS = 60_000;
const RETRY_MIN_MS = 30_000;
const RETRY_MAX_MS = 15 * 60_000;

export class PushService extends EventEmitter {
  private remoteService: RemoteService;
  private pushReceiver: PushReceiver;

  private _connected = false;
  private connectionPromise: Promise<void> | null = null;

  private keepConnected = false;
  private backgroundAttempt?: Promise<void>;
  private retryTimer?: NodeJS.Timeout;
  private retryDelay = RETRY_MIN_MS;

  constructor(private logger: Logger) {
    super();

    this.remoteService = new RemoteService();

    this.pushReceiver = new PushReceiver({
      ...this.getPushReceiverConfig(),
      firebase: {
        apiKey: 'AIzaSyDItp2IsB99y12LFz8tYu9xJvuu81CwT5o',
        authDomain: 'camera-ui-auth.firebaseapp.com',
        projectId: 'camera-ui-auth',
        storageBucket: 'camera-ui-auth.firebasestorage.app',
        messagingSenderId: '572971064517',
        appId: '1:572971064517:web:d56fbf6fb7ad3d501864ac',
        measurementId: 'G-LTBRW89JEH',
      },
      heartbeatIntervalMs: 15 * 60 * 1000,
    });

    this.pushReceiver.onCredentialsChanged(({ newCredentials }) => {
      const config = this.getPushReceiverConfig();
      config.credentials = newCredentials;
      this.savePushReceiverConfig(config);
    });

    this.pushReceiver.onNotification(({ message }) => {
      const config = this.getPushReceiverConfig();
      config.persistentIds = this.pushReceiver.persistentIds;
      this.savePushReceiverConfig(config);
      this.emit('notification', message);
    });
  }

  public get connected(): boolean {
    return this._connected;
  }

  public get registrationId(): string | undefined {
    return this.getPushReceiverConfig().credentials?.fcm?.token;
  }

  public async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    this.connectionPromise ??= this.openConnection().finally(() => {
      this.connectionPromise = null;
    });
    return this.connectionPromise;
  }

  public connectInBackground(): void {
    this.keepConnected = true;
    if (this._connected || this.retryTimer || this.backgroundAttempt) {
      return;
    }

    this.backgroundAttempt = this.connect()
      .then(
        () => {
          this.retryDelay = RETRY_MIN_MS;
        },
        (error) => {
          if (!this.keepConnected) {
            return;
          }
          this.logger.warn(`Push connection failed, retrying in ${Math.round(this.retryDelay / 1000)}s:`, error?.message ?? error);
          this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined;
            if (this.keepConnected) {
              this.connectInBackground();
            }
          }, this.retryDelay);
          this.retryTimer.unref();
          this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
        },
      )
      .finally(() => {
        this.backgroundAttempt = undefined;
      });
  }

  public disconnect(): void {
    this.keepConnected = false;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;

    if (!this._connected && !this.connectionPromise) {
      return;
    }

    this._connected = false;
    this.pushReceiver.destroy();
  }

  private async openConnection(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no answer from FCM within ${CONNECT_TIMEOUT_MS / 1000}s`)), CONNECT_TIMEOUT_MS);
      timer.unref();
    });

    try {
      await Promise.race([this.pushReceiver.connect(), timeout]);
      this._connected = true;
      this.emit('connected');
    } catch (error) {
      // the receiver keeps its socket and retry timer, a second connect must not run beside them
      this.pushReceiver.destroy();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private getPushReceiverConfig(): Partial<Types.ClientConfig> {
    return this.remoteService.getCloud().push ?? {};
  }

  private async savePushReceiverConfig(config: Partial<Types.ClientConfig>): Promise<void> {
    const existing = this.remoteService.getCloud().push ?? {};
    await this.remoteService.patchCloud({
      push: { ...existing, ...config },
    });
  }
}
