import { createRPCClient } from '@camera.ui/rpc';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { container } from 'tsyringe';

import { WorkersService } from '../api/services/workers.service.js';
import { CastManager } from '../manager/castManager.js';
import { CoreManager } from '../manager/coreManager.js';
import { DeviceManager } from '../manager/deviceManager.js';
import { DiscoveryManager } from '../manager/discoveryManager.js';
import { DownloadManager } from '../manager/downloadManager.js';
import { NotificationManager } from '../manager/notificationManager.js';
import { TerminalManager } from '../manager/terminalManager.js';
import { TrainingCandidateManager } from '../manager/trainingCandidateManager.js';
import { workerName } from '../services/config/defaults.js';
import { isMovedAway, readMoveRecord } from '../services/config/move.js';
import { NATS } from './server.js';
import { generateCredentials, safeAsync } from './utils.js';

import type { RPCClient } from '@camera.ui/rpc';
import type { CameraUiAPI } from '../api.js';
import type { ConfigService } from '../services/config/index.js';
import type { LoggerService } from '../services/logger/index.js';
import type { ProxyAuth } from './interfaces/config.js';

export class ProxyServer {
  public server: NATS;
  public proxy!: RPCClient;

  public castManager!: CastManager;
  public coreManager!: CoreManager;
  public deviceManager!: DeviceManager;
  public discoveryManager!: DiscoveryManager;
  public downloadManager!: DownloadManager;
  public notificationManager!: NotificationManager;
  public trainingCandidateManager!: TrainingCandidateManager;
  public terminalManager!: TerminalManager;

  public auth: ProxyAuth = {
    cluster: generateCredentials(),
    server: generateCredentials(),
    viewer: generateCredentials(),
  };

  private api?: CameraUiAPI;
  private logger: LoggerService;

  private initialized = false;
  private leafAuthQueue: Promise<void> = Promise.resolve();
  private readonly workerMode: boolean;
  private readonly masterLink: boolean;

  constructor(options?: { workerMode?: boolean; masterLink?: boolean }) {
    provide('proxy', this);

    this.workerMode = options?.workerMode ?? false;
    this.masterLink = options?.masterLink ?? true;
    this.logger = inject('logger');

    this.server = new NATS(this.auth);

    if (!this.workerMode) {
      this.api = container.resolve<CameraUiAPI>('api');
      this.castManager = new CastManager();
      this.coreManager = new CoreManager();
      this.deviceManager = new DeviceManager();
      this.discoveryManager = new DiscoveryManager();
      this.downloadManager = new DownloadManager();
      this.notificationManager = new NotificationManager();
      this.terminalManager = new TerminalManager();
      this.trainingCandidateManager = new TrainingCandidateManager();

      // this.api.setMaxListeners(this.api.getMaxListeners() + 1);
      // this.api.once(API_EVENT.SHUTDOWN, this.close.bind(this));
    }
  }

  public configureLeafNode(): void {
    const configService = container.resolve<ConfigService>('configService');
    const workersConfig = configService.config.workers;

    if (!this.workerMode) {
      this.server.setClusterListenerEnabled(true);

      const credentials = new WorkersService().listCredentials();
      // workers find the new server only while this one stays silent
      const movedAway = isMovedAway(readMoveRecord(configService.MOVE_FILE));
      this.server.setLeafNodeConfig({
        enabled: !!workersConfig?.enabled && !movedAway,
        host: '0.0.0.0',
        port: workersConfig?.port ?? 7422,
        users: credentials.map((cred) => ({ agentId: cred.agentId, user: cred.user, password: cred.secret })),
        tlsCertFile: configService.HOST_CERT_FILE,
        tlsKeyFile: configService.HOST_KEY_FILE,
      });
    }

    if (this.workerMode) {
      // nats keeps one leaf per server_name, duplicate names push each other off
      this.server.setServerName(`camera.ui-worker-${new WorkersService().getOrCreateAgentId(workerName(configService.config.worker))}`);

      const connection = new WorkersService().getWorkerConnection();
      if (!connection || !this.masterLink) {
        this.server.setLeafNodeRemotes([]);
        return;
      }

      const caFile = join(configService.STORAGE_PATH, 'worker-master-ca.crt');
      writeFileSync(caFile, connection.ca);

      const encodedUser = encodeURIComponent(connection.user);
      const encodedSecret = encodeURIComponent(connection.secret);
      this.server.setLeafNodeRemotes([
        {
          url: `tls://${encodedUser}:${encodedSecret}@${connection.master}:${connection.leafPort}`,
          caFile,
          disabled: !!new WorkersService().getUnpaired(),
        },
      ]);
    }
  }

  public applyLeafNodeAuth(): Promise<void> {
    this.leafAuthQueue = this.leafAuthQueue
      .catch(() => {})
      .then(() => {
        this.configureLeafNode();
        return this.server.reconcileLeafAcceptor();
      });
    return this.leafAuthQueue;
  }

  public async initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    this.configureLeafNode();
    await this.server.start();

    this.proxy = createRPCClient({
      name: 'camera.ui',
      servers: this.server.endpoints.filter((endpoint) => endpoint.startsWith('nats://')),
      auth: {
        user: this.auth.server.user,
        password: this.auth.server.password,
      },
    });

    await this.proxy.connect();

    if (!this.workerMode) {
      await this.castManager.register();
      await this.coreManager.register();
      await this.deviceManager.register();
      await this.discoveryManager.register();
      await this.downloadManager.register();
      await this.notificationManager.register();
      await this.trainingCandidateManager.register();
      await this.terminalManager.register();
    }
  }

  public async close(): Promise<void> {
    if (!this.workerMode) {
      await safeAsync(this.castManager.destroy());
      await safeAsync(this.terminalManager.destroy());
      await safeAsync(this.downloadManager.destroy());
      await safeAsync(this.discoveryManager.destroy());
      await safeAsync(this.notificationManager.destroy());
      await safeAsync(this.trainingCandidateManager.destroy());
    }
    await safeAsync(this.server.stop());
    // proxy is unset when startup failed before initialize() (e.g. pairing)
    if (this.proxy) {
      await safeAsync(this.proxy.disconnect());
    }
    this.logger.debug('Proxy server closed');
  }
}
