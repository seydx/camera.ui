import { Logger } from '@camera.ui/common/logger';
import { fork } from 'node:child_process';

import { inject } from '../../container.js';
import { NamespaceManager } from '../../rpc/namespaces.js';
import { nodeDecoderPath } from '../../utils/path.js';
import { DECODER_STOP_BUDGET_MS, SupervisedChild, supervisedSpawn } from '../../utils/supervised-child.js';
import { Slots } from '../lifecycle/limits.js';
import { ManagedWorkload } from '../lifecycle/managed-workload.js';
import { WorkerCapability } from '../types.js';
import { stopEach } from './handler.js';

import type { LogEntry } from '@camera.ui/common/logger';
import type { NATS } from '../../rpc/server.js';
import type { ConfigService } from '../../services/config/index.js';
import type { StopReason, WorkloadDriver, WorkloadHooks } from '../lifecycle/managed-workload.js';
import type { WorkloadMode } from '../lifecycle/workload.js';
import type { RemoteCameraConfig, WorkerProcessRef, WorkloadLive } from '../types.js';
import type { CapabilityHandler, HostedStatus } from './handler.js';

const START_SLOTS = 4;

interface CameraSettings {
  config: RemoteCameraConfig;
  live?: WorkloadLive;
}

interface HostedCamera {
  settings: CameraSettings;
  workload: ManagedWorkload;
}

export class FrameDecodingHandler implements CapabilityHandler<WorkerCapability.FrameDecoding> {
  public readonly capability = WorkerCapability.FrameDecoding;

  private cameras = new Map<string, HostedCamera>();
  private stopping = new Map<HostedCamera, string>();
  private slots = new Slots(START_SLOTS);
  private logManager = inject('logManager');
  private isClosed = false;

  constructor(
    private readonly agentId: string,
    private readonly natsServer: NATS,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
    private readonly forwardLog: (entry: LogEntry) => void,
    private readonly mode: () => WorkloadMode,
    private readonly hooks: WorkloadHooks = {},
  ) {}

  public async start(id: string, spec: RemoteCameraConfig, live?: WorkloadLive): Promise<void> {
    await this.stop(id);
    if (this.isClosed) {
      return;
    }

    const settings: CameraSettings = { config: spec, live };
    this.logger.log(`Starting camera: ${cameraName(settings)} (${id})`);

    const workload = new ManagedWorkload(this.driver(settings), this.logger, this.mode, this.hooks);
    this.cameras.set(id, { settings, workload });
    workload.start();
  }

  public async stop(id: string, reason?: StopReason, budgetMs?: number): Promise<HostedStatus | undefined> {
    const hosted = this.cameras.get(id);
    if (!hosted) {
      return undefined;
    }

    this.logger.log(`Stopping camera: ${cameraName(hosted.settings)} (${id})`);
    this.cameras.delete(id);
    this.stopping.set(hosted, id);
    try {
      await hosted.workload.stop(reason, budgetMs);
    } finally {
      this.stopping.delete(hosted);
    }
    this.hooks.onChange?.();
    return hosted.workload.status;
  }

  public async stopAll(reason?: StopReason, budgetMs?: number): Promise<Map<string, HostedStatus>> {
    return stopEach(this.cameras.keys(), (id) => this.stop(id, reason, budgetMs));
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    await this.stopAll();
  }

  public stillDesired(id: string): void {
    this.cameras.get(id)?.workload.stillDesired();
  }

  public setLive(id: string, live: WorkloadLive | undefined): void {
    const hosted = this.cameras.get(id);
    if (hosted) {
      hosted.settings.live = live;
    }
  }

  public status(id: string): HostedStatus | undefined {
    return this.cameras.get(id)?.workload.status;
  }

  public getActiveWorkIds(): string[] {
    return Array.from(this.cameras.keys());
  }

  public getActiveProcesses(): WorkerProcessRef[] {
    const refs: WorkerProcessRef[] = [];
    for (const [id, hosted] of [...this.cameras, ...Array.from(this.stopping, ([stopping, stoppingId]) => [stoppingId, stopping] as const)]) {
      const pid = hosted.workload.pid;
      if (pid) {
        refs.push({ capability: this.capability, id, pid });
      }
    }
    return refs;
  }

  private driver(settings: CameraSettings): WorkloadDriver {
    return {
      get label() {
        return `Camera ${cameraName(settings)}`;
      },
      provisions: false,
      provision: async () => {},
      spawn: (signal, instanceId) =>
        this.slots.run(signal, async () => {
          signal.throwIfAborted();
          const child = this.forkFrameWorker(settings, instanceId);
          await new Promise<void>((resolve, reject) => {
            child.child.once('spawn', resolve);
            child.child.once('error', reject);
          });
          this.logger.log(`FrameWorker for ${cameraName(settings)} started with PID: ${child.pid}`);
          return child;
        }),
    };

    this.logger.debug(`Forking FrameWorker for ${name}`);

    const child = fork(nodeDecoderPath, [processName], {
      env: { ...process.env, ...env },
      silent: true,
    });

    child.once('spawn', () => {
      this.logger.log(`FrameWorker for ${config.cameraName} started with PID: ${child.pid}`);
      if (child.pid) {
        this.configService.addProcess({
          pid: child.pid,
          startTime: Date.now(),
          command: process.execPath,
          args: [processName],
          titles: [processName],
        });
      }
    });

    child.on('error', (error) => {
      this.logger.error(`FrameWorker for ${name} reported an error!`, error);
    });
    for (const stream of [child.stdout, child.stderr]) {
      let buffer = '';
      stream?.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          this.processLogLine(line, settings.config.cameraId, child.pid);
        }
      });
      // the last line before a crash usually has no newline
      stream?.once('end', () => {
        this.processLogLine(buffer, settings.config.cameraId, child.pid);
        buffer = '';
      });
    }

    managed.logBuffer += data.toString();

    const lines = managed.logBuffer.split('\n');
    managed.logBuffer = lines.pop() ?? '';

    for (const line of lines) {
      this.processLogLine(line, config, pid);
    }
  }

  private processLogLine(line: string, cameraId: string, pid?: number): void {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes('returning true from eof_received')) {
      return;
    }

    const entry: LogEntry = Logger.parseChildLog(trimmed) ?? {
      timestamp: Date.now(),
      level: 'raw',
      prefix: '',
      message: trimmed,
      targetId: cameraId,
      targetType: 'camera',
      source: 'child',
      processId: pid,
    };

    this.logManager.handleChildLog(entry);
    this.forwardLog(entry);
  }
}

function cameraName(settings: CameraSettings): string {
  return settings.live?.cameraName ?? settings.config.cameraName ?? settings.config.cameraId;
}
