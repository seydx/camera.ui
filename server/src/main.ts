#!/usr/bin/env node

process.title = 'camera.ui';

import 'reflect-metadata';
import './utils/env.js';

import { IS_ELECTRON, SignalHandler, sleep } from '@camera.ui/common/utils';
import { execSync } from 'node:child_process';
import { container } from 'tsyringe';

import { CameraUiAPI } from './api.js';
import { Database } from './api/database/index.js';
import { tryInject } from './container.js';
import { ProxyServer } from './rpc/index.js';
import { ConfigService } from './services/config/index.js';
import { LoggerService } from './services/logger/index.js';
import { markShuttingDown, resetShuttingDown } from './shutdown-state.js';
import { acquireInstanceLock } from './utils/instance-lock.js';
import { FatalBootError, initAppUpdateListener, reportStartError, requestServerUpdate, sendIPCMessage } from './utils/ipc.js';
import { killProcesses } from './utils/process.js';
import { WorkerAgent } from './workers/agent.js';
import { ensureWorkerPaired } from './workers/pairing.js';

import type { CameraUi } from './master.js';

const BOOT_ID = randomBytes(4).toString('hex');

class CameraUiWorker {
  public readonly logger: LoggerService;

  private configService: ConfigService;
  private database: Database;
  private proxy: ProxyServer;
  private agent!: WorkerAgent;
  private signalHandler: SignalHandler;

  constructor() {
    container.registerInstance('cameraui', this);

    this.logger = new LoggerService();

    this.signalHandler = new SignalHandler({
      displayName: '[Signal]',
      timeoutDuration: 5000,
      logger: this.logger,
      reportErrors: WITH_REPORTS,
      reportDirectory: REPORT_DIR,
      closeFunction: this.close.bind(this),
    });

    const homePath = process.argv.find((arg) => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]);

    this.configService = new ConfigService(homePath);
    reapTrackedProcessesOnExit(this.configService);

    const logLevel = this.configService.config.logger?.level === 'debug' ? 'debug' : this.configService.config.logger?.level === 'trace' ? 'trace' : 'log';
    this.logger.initLogManager(this.configService.LOGS_PATH, this.configService.LOG_FILE, logLevel);

    // Worker-mode database: only opens workerStateDB, skips migrations + master setup.
    this.database = new Database(true);

    // No Go2RTC, no HTTP server in worker mode
    this.proxy = new ProxyServer({ workerMode: true });
  }

  public async start(): Promise<void> {
    resetShuttingDown();

    this.logger.log('---');
    this.logger.log('Starting camera.ui in WORKER mode');
    this.logger.log('---');

    // Must run before the proxy: the leaf-node remote is built from the
    // credentials this obtains/stores.
    await ensureWorkerPaired(this.configService, this.logger);

    // no go2rtc and no HTTP server in worker mode
    this.proxy = new ProxyServer({ workerMode: true, masterLink: pairing.state === 'paired' });
    await this.proxy.initialize();
    this.proxy.server.onFatal = () => this.owner.crash();

    this.agent = new WorkerAgent((reason) => this.owner.shutdown(reason), pairing);
    await this.agent.start();
  }

  public async close(): Promise<void> {
    markShuttingDown();

    await this.agent?.close(this.owner.reason);
    await this.proxy?.close();
    await this.database?.close();

    await sleep(1000);

    const processes = this.configService.processes;
    await killProcesses(
      processes.map((p) => p.pid),
      { silent: true },
    );
  }

  private async reportMasterLink(): Promise<void> {
    const master = this.configService.config.worker?.master;
    const leaf = this.proxy.server.leaf;

    if (await leaf.whenConnected(MASTER_LINK_TIMEOUT_MS)) {
      this.logger.log('Worker is ready and connected to master');
    } else {
      this.logger.error(`Worker is running but has no link to master ${master}: ${leaf.lastError ?? 'no answer'}`);
    }

    leaf.onChange = (connected) => {
      if (connected) {
        this.logger.log(`Link to master ${master} is up`);
      } else {
        this.logger.warn(`Link to master ${master} is down, retrying`);
      }
    };
  }
}

const isWorkerMode = process.argv.includes('--worker') || process.env.CAMERA_UI_WORKER === 'true';

function reapTrackedProcessesOnExit(configService: ConfigService): void {
  process.on('exit', () => {
    for (const proc of configService.processes) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
        } else {
          process.kill(proc.pid, 'SIGKILL');
        }
      } catch {
        // already gone
      }
    }
  });
}

async function launch(): Promise<void> {
  initAppUpdateListener();

  const homeArg = isWorkerMode ? process.argv.find((arg) => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]) : process.argv[2];
  const homePath = ConfigService.resolveHomePath(homeArg);
  if (!(await acquireInstanceLock(homePath))) {
    const error = new FatalBootError(`Another camera.ui is already running with the home ${homePath}. Stop it first or start this one with a different home (-H).`);
    console.error(error.message);
    await reportStartError(error);
    process.exit(1);
  }

  if (isWorkerMode) {
    process.title = 'camera.ui-worker';

    let worker: CameraUiWorker | undefined;
    try {
      worker = new CameraUiWorker();
      await worker.start();
      sendIPCMessage({ type: 'STARTED', port: 0 });
    } catch (error) {
      (worker?.logger ?? console).error('Failed to start camera.ui worker', error);
      await reportStartError(error);
      await worker?.close();
      process.exit(1);
    }

    return;
  }

  let cameraui: CameraUi | undefined;
  try {
    const { CameraUi } = await import('./master.js');
    cameraui = new CameraUi();
    await cameraui.start();
    sendIPCMessage({ type: 'STARTED', port: cameraui.port });
  } catch (error) {
    (cameraui?.logger ?? console).error('Failed to start camera.ui', error);

    await reportStartError(error);
    await cameraui?.close();

    process.exit(1);
  }
}

launch().catch((error) => {
  console.error('Failed to start camera.ui:', error);
  process.exit(1);
});
