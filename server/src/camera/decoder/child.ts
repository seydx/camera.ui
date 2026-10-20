process.title = process.argv[2] ?? 'camera.ui - Frame Worker';
const REMOTE_SUFFIX = process.title.includes('(remote)') ? ' (remote)' : '';

import { Logger } from '@camera.ui/common/logger';
import { SignalHandler } from '@camera.ui/common/utils';
import { RPCMethod, createRPCClient } from '@camera.ui/rpc';
import { AV_LOG_WARNING } from 'node-av/constants';
import { Log } from 'node-av/lib';
import { fileURLToPath } from 'node:url';

import { watchReconnect } from '../../plugins/runtime/node/proxy/reconnect.js';
import { NamespaceManager } from '../../rpc/namespaces.js';
import { REPORT_DIR, WITH_REPORTS } from '../../utils/crash.js';
import { HANDSHAKE_LEVEL, hostSpeaksStopLine, hostStopBudget, INSTANCE_ID_ENV, listenForHostStop } from '../../utils/host-protocol.js';
import { DetectionCoordinator } from './detection-coordinator.js';

import type { LoggerOptions } from '@camera.ui/common';
import type { PrivateChannel, RPCClient } from '@camera.ui/rpc';
import type { CameraDetectionSettings, CameraFrameWorkerSettings, CameraUiSettings, CameraZones, PtzAutotrackSettings } from '@camera.ui/sdk';
import type { CoreManagerNamespaces, FrameWorkerNamespaces } from '../../rpc/namespaces.js';
import type { DetectionCoordinatorConfig } from './detection-coordinator.js';
import type { FrameWorkerPerfSnapshot, ObjectBenchmarkResult, WorkerToMainMessage } from './types.js';

const ignorableLogMessages = [
  'vt decoder cb: output image buffer is null',
  'hardware accelerator failed to decode picture',
  'Could not find ref with POC',
  'Error constructing the frame RPS',
  'Skipping invalid undecodable NALU',
  'reference picture missing during reorder',
  'Missing reference picture',
  'First slice in a frame missing',
  'non-existing SPS',
  'non-existing PPS',
  'Failed to send close message', // Windows tls
];

const CLIENT_OPTIONS = { zeroCopyBinaries: true };

type InitializeKey = Pick<
  DetectionCoordinatorConfig,
  | 'cameraId'
  | 'streamUrl'
  | 'snapshotUrl'
  | 'audioStreamUrl'
  | 'controllerSnapshotSourceId'
  | 'availableSources'
  | 'streamRole'
  | 'zones'
  | 'detectionSettings'
  | 'ptzAutotrack'
  | 'frameWorkerSettings'
  | 'streamHot'
>;

export class FrameWorkerChild {
  public readonly proxy: RPCClient;
  public readonly namespaces: FrameWorkerNamespaces & CoreManagerNamespaces;
  public readonly logger: Logger;

  private channel?: PrivateChannel;
  private closeDetectionHandler?: () => Promise<void>;
  private closeChildHandler?: () => Promise<void>;
  private stopReconnectWatch?: () => void;
  private signalHandler: SignalHandler;

  private detectionCoordinator?: DetectionCoordinator;
  private applied?: InitializeKey;
  private initializing: Promise<unknown> = Promise.resolve();
  private sessionSeen = false;
  private closing = false;

  constructor() {
    this.proxy = createRPCClient({
      name: NamespaceManager.frameWorkerNamespaces(process.env.CAMERA_ID!).frameWorkerChild,
      servers: process.env.PROXY_ENDPOINTS!.split(','),
      auth: {
        user: process.env.PROXY_USER!,
        password: process.env.PROXY_PASSWORD!,
      },
    });

    this.namespaces = {
      ...NamespaceManager.frameWorkerNamespaces(process.env.CAMERA_ID!),
      ...NamespaceManager.coreManagerNamespaces(),
    };

    const loggerOptions: LoggerOptions = {
      prefix: 'Frame Worker',
      suffix: process.env.CAMERA_NAME!,
      debugEnabled: process.env.LOGGER_LEVEL === 'debug' || process.env.LOGGER_LEVEL === 'trace',
      traceEnabled: process.env.LOGGER_LEVEL === 'trace',
      targetId: process.env.CAMERA_ID!,
      targetType: 'camera',
    };

    this.logger = new Logger(loggerOptions);
    this.logger.setChildProcessMode(true);

    Log.setCallback(
      (_, message) => {
        if (ignorableLogMessages.some((ignorable) => message.includes(ignorable))) {
          return;
        }

        this.logger.trace(message);
      },
      { maxLevel: AV_LOG_WARNING },
    );

    this.signalHandler = new SignalHandler({
      displayName: '[Signal]',
      timeoutDuration: hostStopBudget(1000),
      logger: this.logger,
      reportErrors: WITH_REPORTS,
      reportDirectory: REPORT_DIR,
      ignoreSIGINT: hostSpeaksStopLine(),
      closeFunction: this.close.bind(this),
    });
    listenForHostStop(this.signalHandler);
  }

  public async run(): Promise<void> {
    try {
      await this.proxy.connect();
      await this.onStart();
    } catch (error: any) {
      this.logger.error(`Failed to connect to proxy server: ${error.message}`);
      process.exit(1);
    }
  }

  @RPCMethod
  public async initialize(config: DetectionCoordinatorConfig): Promise<InitializeResult> {
    const own = process.env[INSTANCE_ID_ENV];
    if (config.session?.instanceId && own && config.session.instanceId !== own) {
      throw new Error(`initialize is meant for instance ${config.session.instanceId}, this is ${own}`);
    }
    if (config.session) {
      this.sessionSeen = true;
    }

    const result = this.initializing.then(() => this.applyConfig(config));
    this.initializing = result.catch(() => {});
    return result;
  }

  @RPCMethod
  public updateZoneConfig(zones: CameraZones): void {
    this.detectionCoordinator?.updateZoneConfig(zones);
    this.keep('zones', zones);
  }

  @RPCMethod
  public updateDetectionSettings(settings: CameraDetectionSettings): void {
    this.detectionCoordinator?.updateDetectionSettings(settings);
    this.keep('detectionSettings', settings);
  }

  @RPCMethod
  public updatePtzAutotrackSettings(settings: PtzAutotrackSettings): void {
    this.detectionCoordinator?.updatePtzAutotrackSettings(settings);
    this.keep('ptzAutotrack', settings);
  }

  @RPCMethod
  public updateFrameWorkerSettings(settings: CameraFrameWorkerSettings): void {
    this.detectionCoordinator?.updateFrameWorkerSettings(settings);
    this.keep('frameWorkerSettings', settings);
  }

  @RPCMethod
  public updateInterfaceSettings(settings: CameraUiSettings): void {
    this.detectionCoordinator?.updateInterfaceSettings(settings);
  }

  @RPCMethod
  public updateNvrRpc(namespace?: string): void {
    this.detectionCoordinator?.updateNvrRpc(namespace);
  }

  @RPCMethod
  public updateCameraName(name: string): void {
    this.logger.suffix = name;
    process.title = `camera.ui - Frame Worker [${name}]${REMOTE_SUFFIX}`;
  }

  @RPCMethod
  public getPerfSnapshot(): FrameWorkerPerfSnapshot | null {
    return this.detectionCoordinator?.getPerfSnapshot() ?? null;
  }

  @RPCMethod
  public resetPerf(): void {
    this.detectionCoordinator?.resetPerf();
  }

  @RPCMethod
  public pauseForBenchmark(paused: boolean): void {
    this.detectionCoordinator?.pauseForBenchmark(paused);
  }

  @RPCMethod
  public async runObjectBenchmark(iterations: number, concurrency: number): Promise<ObjectBenchmarkResult | null> {
    return (await this.detectionCoordinator?.runObjectBenchmark(iterations, concurrency)) ?? null;
  }

  private async onStart(): Promise<void> {
    await this.openChannel();

    this.closeChildHandler = await this.proxy.registerHandler(this.namespaces.frameWorkerChildRpc, this, {
      isolatedConnection: true,
    });

    // writes sent while the link was down may be lost, the next go out in full
    this.stopReconnectWatch = watchReconnect(
      this.proxy,
      async () => {
        this.detectionCoordinator?.forgetSensorWrites();
        this.detectionCoordinator?.reconnectSources();
      },
      (error) => this.logger.debug('Reconnect watch ended:', error),
      { debounce: true },
    );

    this.sendStarted(false);
  }

  private async applyConfig(config: DetectionCoordinatorConfig): Promise<InitializeResult> {
    const instanceId = process.env[INSTANCE_ID_ENV];
    // the coordinator normalizes parts of its config in place
    const key = structuredClone(initializeKey(config));
    const running = this.detectionCoordinator;

    if (running && this.applied && canonical(this.applied) === canonical(key)) {
      running.forgetSensorWrites();
      running.updateNvrRpc(config.nvrRpc);
      running.updateInterfaceSettings(config.interfaceSettings);
      running.reconnectSources();
      this.logger.debug('Kept the running detection, the config did not change');
      return { instanceId, reused: true };
    }

    this.applied = undefined;
    this.detectionCoordinator = undefined;
    await this.closeDetectionHandler?.();
    this.closeDetectionHandler = undefined;
    await running?.dispose();

    const coordinator = new DetectionCoordinator(config, this.proxy, this.logger);
    this.detectionCoordinator = coordinator;
    const detectionNamespaces = NamespaceManager.frameWorkerDetectionNamespaces(process.env.CAMERA_ID!);
    this.closeDetectionHandler = await this.proxy.registerHandler(detectionNamespaces.detectionRpc, coordinator, {
      isolatedConnection: true,
    });
    this.applied = key;
    return { instanceId, reused: false };
  }

  private keep<K extends keyof InitializeKey>(part: K, value: InitializeKey[K]): void {
    if (this.applied) {
      this.applied[part] = structuredClone(value);
    }
  }

  private async openChannel(): Promise<void> {
    const channel = await this.proxy.privateChannel('frameworker-communication', 'camera.ui');
    channel.on('message', (message: MainToWorkerMessage) => this.onChannelMessage(message));
    channel.on('close', () => this.onChannelClose(channel));
    this.channel = channel;
  }

  private onChannelClose(channel: PrivateChannel): void {
    if (this.closing || channel !== this.channel || !this.sessionSeen) {
      return;
    }
    this.openChannel().catch((error) => this.logger.warn('Could not open the channel to camera.ui again:', error));
  }

  private onChannelMessage(message: MainToWorkerMessage): void {
    if (message?.message !== 'resume') {
      return;
    }
    const own = process.env[INSTANCE_ID_ENV];
    if (message.data?.instanceId && own && message.data.instanceId !== own) {
      this.logger.debug(`Ignored resume for instance ${message.data.instanceId}`);
      return;
    }
    this.sessionSeen = true;
    this.detectionCoordinator?.reconnectSources();
    this.sendStarted(this.applied !== undefined);
  }

  private sendStarted(resume: boolean): void {
    const instanceId = process.env[INSTANCE_ID_ENV];
    this.sendMessage({ message: 'started', data: { instanceId, handshake: HANDSHAKE_LEVEL, resume }, instanceId }).catch((error) =>
      this.logger.debug('Could not send started:', error),
    );
  }

  private async sendMessage(message: WorkerToMainMessage): Promise<void> {
    await this.channel?.send<WorkerToMainMessage>(message);
  }

  private async close(): Promise<void> {
    this.closing = true;
    this.stopReconnectWatch?.();
    await this.detectionCoordinator?.dispose();
    await this.channel?.close();
    await this.closeDetectionHandler?.();
    await this.closeChildHandler?.();
    await this.proxy.disconnect();
  }
}

function initializeKey(config: DetectionCoordinatorConfig): InitializeKey {
  return {
    cameraId: config.cameraId,
    streamUrl: config.streamUrl,
    snapshotUrl: config.snapshotUrl,
    audioStreamUrl: config.audioStreamUrl,
    controllerSnapshotSourceId: config.controllerSnapshotSourceId,
    availableSources: config.availableSources,
    streamRole: config.streamRole,
    zones: config.zones,
    detectionSettings: config.detectionSettings,
    ptzAutotrack: config.ptzAutotrack,
    frameWorkerSettings: config.frameWorkerSettings,
    streamHot: config.streamHot,
  };
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_, field) =>
    field && typeof field === 'object' && !Array.isArray(field) ? Object.fromEntries(Object.entries(field).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : field,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const frameworker = new FrameWorkerChild();
  frameworker.run();
}
