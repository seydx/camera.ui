import { pathExists, readJson } from 'fs-extra/esm';
import { dirname, join } from 'node:path';

import { WorkersService } from '../../api/services/workers.service.js';
import { extractBundledPlugin } from '../../plugins/bundle.js';
import { PluginManager } from '../../plugins/index.js';
import { resolvePluginMain } from '../../plugins/main-file.js';
import { RuntimeFactory } from '../../plugins/runtime/index.js';
import { isShuttingDown } from '../../shutdown-state.js';
import { checkProtocolCompat } from '../../utils/engines.js';
import { extractPackage, installDependencies } from '../../utils/npm/index.js';
import { describePlatformRequirement, isPlatformCompatible } from '../../utils/platform.js';
import { KeyedLock, Slots } from '../lifecycle/limits.js';
import { ManagedWorkload, ProvisionError } from '../lifecycle/managed-workload.js';
import { WorkerCapability } from '../types.js';
import { stopEach } from './handler.js';

import type { LogEntry, Logger } from '@camera.ui/common/logger';
import type { IPackageJson } from '../../api/types/index.js';
import type { BasePluginRuntime, RuntimePlugin } from '../../plugins/runtime/base.js';
import type { ConfigService } from '../../services/config/index.js';
import type { ChildExit } from '../../utils/supervised-child.js';
import type { StopReason, WorkloadDriver, WorkloadHooks, WorkloadProcess } from '../lifecycle/managed-workload.js';
import type { WorkloadMode, WorkloadPhase } from '../lifecycle/workload.js';
import type { PluginBuild, PluginInstallReport, RemotePluginConfig, RemotePluginState, RemotePluginStatus, WorkerProcessRef, WorkloadLive } from '../types.js';
import type { CapabilityHandler, HostedStatus } from './handler.js';

const START_SLOTS = 2;

interface PluginSettings {
  config: RemotePluginConfig;
  live?: WorkloadLive;
  version?: string;
  linked?: boolean;
}

interface HostedPlugin {
  settings: PluginSettings;
  workload: ManagedWorkload;
}

interface InstallState {
  version?: string;
  artifact?: InstallArtifact;
  finished: boolean;
}

type StagedBuild = PluginBuild & { pluginName: string };

export class PluginHostHandler implements CapabilityHandler<WorkerCapability.PluginHost> {
  public readonly capability = WorkerCapability.PluginHost;

  private plugins = new Map<string, HostedPlugin>();
  private stopping = new Map<HostedPlugin, { id: string; stopped: Promise<void> }>();
  private installs = new Map<string, PluginInstallReport>();
  private prepares = new Map<string, AbortController>();
  private folders = new KeyedLock();
  private slots = new Slots(START_SLOTS);
  private isClosed = false;

  constructor(
    private readonly agentId: string,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
    private readonly forwardLog: (entry: LogEntry) => void,
    private readonly mode: () => WorkloadMode,
    private readonly hooks: WorkloadHooks = {},
  ) {}

  public async start(id: string, spec: RemotePluginConfig, live?: WorkloadLive): Promise<void> {
    await this.stop(id);
    if (this.isClosed) {
      return;
    }

    const settings: PluginSettings = { config: spec, live };
    this.logger.log(`Hosting plugin: ${displayName(settings)} (${spec.pluginName}@${spec.version})`);

    const workload = new ManagedWorkload(this.driver(settings), this.logger, this.mode, this.hooks);
    this.plugins.set(id, { settings, workload });
    workload.start();
    // restarted while staging the next version, stage it again
    if (live?.prepare && live.prepare.version !== spec.version) {
      this.prepare({ ...live.prepare, pluginName: spec.pluginName });
    }
  }

  public async stop(id: string, reason?: StopReason, budgetMs?: number): Promise<HostedStatus | undefined> {
    const hosted = this.plugins.get(id);
    if (!hosted) {
      return undefined;
    }

    this.logger.log(`Stopping hosted plugin: ${displayName(hosted.settings)} (${id})`);
    this.plugins.delete(id);
    const stopped = hosted.workload.stop(reason, budgetMs);
    this.stopping.set(hosted, { id, stopped });
    try {
      await stopped;
    } finally {
      this.stopping.delete(hosted);
    }
    this.hooks.onChange?.();
    return hosted.workload.status;
  }

  public async stopAll(reason?: StopReason, budgetMs?: number): Promise<Map<string, HostedStatus>> {
    return stopEach(this.plugins.keys(), (id) => this.stop(id, reason, budgetMs));
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    for (const abort of this.prepares.values()) abort.abort();
    await this.stopAll();
  }

  public stillDesired(id: string): void {
    this.plugins.get(id)?.workload.stillDesired();
  }

  public setLive(id: string, live: WorkloadLive | undefined): void {
    const hosted = this.plugins.get(id);
    if (hosted) {
      hosted.settings.live = live;
      if (live?.prepare) {
        this.prepare({ ...live.prepare, pluginName: hosted.settings.config.pluginName });
      }
    }
  }

  public status(id: string): HostedStatus | undefined {
    const hosted = this.plugins.get(id);
    if (!hosted) {
      return undefined;
    }
    const { pluginName } = hosted.settings.config;
    return { ...hosted.workload.status, version: hosted.settings.version, linked: hosted.settings.linked, install: this.installs.get(pluginName) };
  }

    const stopPromises = Array.from(this.plugins.keys()).map((id) => this.stop(id));
    await Promise.allSettled(stopPromises);
  }

  public getActiveWorkIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  public getActiveProcesses(): WorkerProcessRef[] {
    const refs: WorkerProcessRef[] = [];
    for (const [id, hosted] of [...this.plugins, ...Array.from(this.stopping, ([stopping, { id: stoppingId }]) => [stoppingId, stopping] as const)]) {
      const pid = hosted.workload.pid;
      if (pid && pid > 0) {
        refs.push({ capability: this.capability, id, pid });
      }
    }
    return refs;
  }

  public getPluginStatuses(): RemotePluginStatus[] {
    return Array.from(this.plugins, ([id, hosted]) => ({ id, state: reportedState(hosted.workload.phase) }));
  }

  private driver(settings: PluginSettings): WorkloadDriver {
    const spec = settings.config;
    let plugin: RuntimePlugin | undefined;

    return {
      get label() {
        return `Plugin ${displayName(settings)}`;
      },
      provisions: true,
      provision: (signal) =>
        this.folders.run(spec.pluginName, signal, async () => {
          const installPath = await this.ensureInstalled(settings, signal);
          signal.throwIfAborted();
          plugin = await this.buildRuntimePlugin(spec, installPath);
          await this.prepareRuntime(settings, plugin, signal);
        }),
      spawn: (signal, instanceId) =>
        this.slots.run(signal, () =>
          this.folders.run(spec.pluginName, signal, async (): Promise<WorkloadProcess> => {
            if (!plugin) {
              throw new Error('plugin is not provisioned');
            }

            const runtime = RuntimeFactory.createRuntime({ ...plugin, displayName: displayName(settings) });
            runtime.logForwarder = this.forwardLog;
            const exited = new Promise<ChildExit>((resolve) =>
              runtime.once('exit', (exit: ChildExit) => {
                runtime.cleanup();
                resolve(exit);
              }),
            );

            try {
              await runtime.start(signal, instanceId);
            } catch (error) {
              runtime.cleanup();
              throw error;
            }

            this.logger.log(`Hosted plugin started: ${displayName(settings)} (${spec.pluginName}@${spec.version})`);
            return {
              get pid() {
                return runtime.getPID() || undefined;
              },
              exited,
              stop: (budgetMs) => runtime.stop(budgetMs),
            };
          }),
        ),
    };
  }

    try {
      const installPath = await this.ensureInstalled(spec);
      if (managed.stopped || this.isClosed) {
        return;
      }

      const plugin = await this.buildRuntimePlugin(spec, installPath);

      const runtime = RuntimeFactory.createRuntime(plugin);
      runtime.logForwarder = this.forwardLog;
      runtime.once('exit', () => {
        if (managed.stopped || this.isClosed || isShuttingDown()) {
          return;
        }
        managed.state = 'retrying';
        this.logger.warn(`Hosted plugin ${spec.displayName} exited — restarting in ${CRASH_RESTART_MS / 1000}s`);
        this.scheduleRetry(managed, CRASH_RESTART_MS);
      });

      managed.runtime = runtime;
      await runtime.start();

      managed.state = 'running';
      this.logger.log(`Hosted plugin started: ${spec.displayName} (${spec.pluginName}@${spec.version})`);
    } catch (error: any) {
      managed.runtime?.cleanup();
      managed.runtime = undefined;
      managed.state = 'retrying';

      if (managed.stopped || this.isClosed) {
        return;
      }
      this.logger.error(`Failed to provision/start plugin ${spec.pluginName}: ${error.message} — retrying in ${PROVISION_RETRY_MS / 1000}s`);
      this.scheduleRetry(managed, PROVISION_RETRY_MS);
    }
  }

  private scheduleRetry(managed: ManagedPlugin, delayMs: number): void {
    if (managed.retryTimer) {
      clearTimeout(managed.retryTimer);
    }

    managed.retryTimer = setTimeout(() => {
      managed.retryTimer = undefined;
      if (managed.stopped || this.isClosed || isShuttingDown()) {
        return;
      }
      this.provisionAndStart(managed);
    }, delayMs);
  }

  private async ensureInstalled(spec: RemotePluginConfig): Promise<string> {
    const installPath = join(this.configService.PLUGINS_INSTALL_PATH, spec.pluginName);

    const installed = await readJson(join(installPath, 'package.json')).catch(() => null);
    if (installed?.version !== spec.version) {
      this.logger.log(`Installing ${spec.pluginName}@${spec.version} (was: ${installed?.version ?? 'not installed'})`);
      await extractPackage(`${spec.pluginName}@${spec.version}`, installPath);
      await installDependencies(installPath, this.configService.config.plugins.allowBuildScripts ?? false, (chunk) => this.logger.debug(chunk.toString().trim()), {
        add: (proc) => this.configService.addProcess(proc),
        remove: (pid) => this.configService.removeProcessByPID(pid),
      });
      await extractBundledPlugin(installPath);
    }

    return installPath;
  }

  private async buildRuntimePlugin(spec: RemotePluginConfig, installPath: string): Promise<RuntimePlugin> {
    const pjson = (await readJson(join(installPath, 'package.json'))) as IPackageJson;

    if (!isPlatformCompatible(pjson.os, pjson.cpu)) {
      throw new ProvisionError(`plugin requires ${describePlatformRequirement(pjson.os, pjson.cpu)}, this worker is ${process.platform}/${process.arch}`, 'platform');
    }

    const protocolCompat = checkProtocolCompat(pjson.cameraui?.protocolLevel);
    if (protocolCompat === 'pluginTooOld') {
      throw new ProvisionError(`plugin ${spec.pluginName} was built for an older camera.ui plugin API, update the plugin`, 'gated');
    }
    if (protocolCompat === 'serverTooOld') {
      throw new ProvisionError(`plugin ${spec.pluginName} was built for a newer camera.ui plugin API, update this worker`, 'gated');
    }

    let main = resolvePluginMain(pjson);
    let mainPath = join(installPath, dirname(main));

    const bundlePackageJsonPath = join(installPath, 'bundle', 'package.json');
    if (await pathExists(bundlePackageJsonPath)) {
      const bundlePjson = (await readJson(bundlePackageJsonPath)) as IPackageJson;
      main = resolvePluginMain(bundlePjson);
      mainPath = join(installPath, 'bundle', dirname(main));
    }

    const contractFile = await PluginManager.loadContractFile(installPath);
    const pythonVersion = contractFile ? PluginManager.normalizeContract(contractFile, spec.pluginName).pythonVersion : undefined;
    const masterAddress = new WorkersService().getWorkerConnection()?.master;

    return {
      id: spec.pluginId,
      pluginName: spec.pluginName,
      displayName: spec.displayName ?? spec.pluginName,
      main,
      mainPath,
      installPath,
      isPython: main.endsWith('.py'),
      isGo: main.endsWith('.go'),
      info: { installedVersion: pjson.version },
      contract: { pythonVersion },
      remoteEnv: {
        CAMERAUI_MASTER_ADDRESS: masterAddress,
        CAMERAUI_RTSP_USERNAME: spec.rtspUsername,
        CAMERAUI_RTSP_PASSWORD: spec.rtspPassword,
      },
    };
  }
}
