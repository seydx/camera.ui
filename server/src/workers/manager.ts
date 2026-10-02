import { Logger } from '@camera.ui/common/logger';
import { isEqual } from '@camera.ui/common/utils';
import { container } from 'tsyringe';

import { CamerasService } from '../api/services/cameras.service.js';
import { PluginsService } from '../api/services/plugins.service.js';
import { WorkersService } from '../api/services/workers.service.js';
import { NamespaceManager, SUBJECT_TOKEN } from '../rpc/namespaces.js';
import { ConfigService } from '../services/config/index.js';
import { describePlatformRequirement, isPlatformCompatible } from '../utils/platform.js';
import { WorkerCapability, workloadKey } from './types.js';

import type { LogEntry, LoggerOptions } from '@camera.ui/common/logger';
import type { Promisify } from '@camera.ui/rpc';
import type { CameraUiAPI } from '../api.js';
import type { SocketService } from '../api/websocket/index.js';
import type { ServerNamespace } from '../api/websocket/nsp/server.js';
import type { WorkersNamespace } from '../api/websocket/nsp/workers.js';
import type { ProxyServer } from '../rpc/index.js';
import type { LogManager } from '../services/logger/logManager.js';
import type { SystemInfo } from '../utils/system-info.js';
import type {
  RemoteCameraConfig,
  RemotePluginConfig,
  RemotePluginState,
  WorkerAgentRPC,
  WorkerHealthInfo,
  WorkerHeartbeat,
  WorkerInfo,
  WorkerProcessSample,
  WorkerSyncResponse,
  WorkloadSpec,
} from './types.js';

const WORKER_TIMEOUT_MS = 15_000;
const OUTDATED_PROBE_MS = 30_000;

export class WorkerManager {
  private readonly logger: Logger;
  private readonly configService: ConfigService;
  private readonly camerasService: CamerasService;
  private readonly workersService: WorkersService;
  private readonly proxyServer: ProxyServer;

  private workers = new Map<string, WorkerInfo>();
  private desired = new Map<string, { agentId: string; workload: WorkloadSpec }>();

  private listeners = new Map<string, Promise<() => Promise<void>>>();
  private probing = new Set<string>();
  private outdated = new Set<string>();
  private timeoutCheckInterval?: NodeJS.Timeout;
  private outdatedProbeInterval?: NodeJS.Timeout;
  private addressWarned = false;
  private workloadRevision = 0;
  private active = false;

  constructor() {
    container.registerInstance('workerManager', this);

    this.configService = container.resolve<ConfigService>('configService');
    this.proxyServer = container.resolve<ProxyServer>('proxy');

    const loggerOptions: LoggerOptions = {
      prefix: 'WorkerManager',
      debugEnabled: this.configService.config.logger?.level === 'debug' || this.configService.config.logger?.level === 'trace',
      traceEnabled: this.configService.config.logger?.level === 'trace',
    };

    this.logger = new Logger(loggerOptions);
    this.camerasService = new CamerasService();
    this.workersService = new WorkersService();
  }

  public isEnabled(): boolean {
    return this.active;
  }

  public async start(): Promise<void> {
    if (this.configService.config.workers?.enabled) {
      await this.enable(false);
    }
  }

  public async enable(reconcileAcceptor = true): Promise<void> {
    if (this.active) {
      return;
    }

    this.logger.log('Enabling WorkerManager');
    this.active = true;

    this.seedKnownWorkers();

    if (!this.proxyServer.proxy) {
      throw new Error('WorkerManager enabled before the proxy was initialized');
    }

    for (const { agentId } of this.workersService.listCredentials()) {
      await this.listen(agentId);
    }

    this.timeoutCheckInterval = setInterval(() => this.checkTimeouts(), 5_000);
    this.outdatedProbeInterval = setInterval(() => this.probeOutdatedWorkers(), OUTDATED_PROBE_MS);

    if (reconcileAcceptor) {
      // Bring up the leaf-acceptor if workers are already paired.
      await this.proxyServer.applyLeafNodeAuth();
    }

    this.logger.log('WorkerManager enabled');
  }

  public async disable(): Promise<void> {
    if (!this.active) {
      return;
    }

    this.logger.log('Disabling WorkerManager');

    const agentIds = Array.from(this.workers.keys());

    await this.teardown();
    this.active = false;

    const pluginsService = new PluginsService();
    for (const agentId of agentIds) {
      for (const camera of this.camerasService.listByAgentId(agentId)) {
        this.restartFrameWorker(camera._id);
      }
      for (const plugin of pluginsService.listByAgentId(agentId)) {
        this.restartPluginWorker(plugin.pluginName);
      }
    }

    await this.proxyServer.applyLeafNodeAuth();

    this.logger.log('WorkerManager disabled');
  }

  public async stop(): Promise<void> {
    await this.teardown();
    this.active = false;
  }

  private async teardown(): Promise<void> {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = undefined;
    }

    if (this.outdatedProbeInterval) {
      clearInterval(this.outdatedProbeInterval);
      this.outdatedProbeInterval = undefined;
    }

    await Promise.all(Array.from(this.listeners.keys()).map((agentId) => this.stopListening(agentId)));
    this.outdated.clear();
    this.workers.clear();
    this.desired.clear();
  }

  public getWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  public isWorkerOnline(agentId: string): boolean {
    const worker = this.workers.get(agentId);
    return worker?.online === true;
  }

  public isWorkerKnown(agentId: string): boolean {
    return this.workers.has(agentId);
  }

  public getAssignment(cameraId: string): string | undefined {
    return this.camerasService.findById(cameraId)?.workerAgentId;
  }

  public isAssignedToWorker(cameraId: string): boolean {
    return this.getAssignment(cameraId) !== undefined;
  }

  public async restartWorker(agentId: string): Promise<void> {
    if (!this.isWorkerOnline(agentId)) {
      throw new Error(`Worker ${agentId} is not online`);
    }
    const workerProxy = this.createWorkerProxy(agentId);
    await workerProxy.restart();
  }

  public async updateWorker(agentId: string, version = ConfigService.RUNNING_VERSION): Promise<void> {
    const worker = this.workers.get(agentId);
    if (!worker?.online) {
      throw new Error(`Worker ${agentId} is not online`);
    }

    // pre-2.1.0 agents don't send it and have no update handler to call
    if (!worker.update) {
      throw new Error(`Worker ${worker.name} runs ${worker.version ?? 'an older version'} and has to be updated once on its own machine`);
    }

    if (!worker.update.updatable) {
      throw new Error(`Worker ${worker.name} runs inside the desktop app and updates with it`);
    }

    if (worker.update.updating) {
      throw new Error(`Worker ${worker.name} is already updating`);
    }

    this.logger.log(`Updating worker ${worker.name} (${agentId}) to ${version}`);

    const workerProxy = this.createWorkerProxy(agentId);
    await workerProxy.update(version);

    worker.update = { ...worker.update, updating: true, error: undefined };
    this.emitWorkerUpdate(worker);
  }

  public async assignCamera(cameraId: string, agentId: string): Promise<void> {
    this.logger.log(`Assigning camera ${cameraId} to worker ${agentId}`);

    const camera = this.camerasService.findById(cameraId);
    if (!camera) {
      throw new Error(`Camera ${cameraId} not found`);
    }

    await this.camerasService.setWorkerAgentId(cameraId, agentId);
    this.restartFrameWorker(cameraId);
  }

  public async unassignCamera(cameraId: string): Promise<void> {
    this.logger.log(`Unassigning camera ${cameraId}`);

    const camera = this.camerasService.findById(cameraId);
    if (!camera) {
      throw new Error(`Camera ${cameraId} not found`);
    }

    await this.camerasService.setWorkerAgentId(cameraId, undefined);
    this.restartFrameWorker(cameraId);
  }

  public async noteWorkerPaired(agentId: string, name: string): Promise<void> {
    await this.workersService.rememberWorker(agentId, name);
    await this.listen(agentId);

    if (!this.workers.has(agentId)) {
      const workerInfo: WorkerInfo = {
        agentId,
        name,
        online: false,
        lastHeartbeat: Date.now(),
        cameras: [],
        capabilities: [],
      };
      this.workers.set(agentId, workerInfo);
      this.emitWorkerUpdate(workerInfo);
    }
  }

  public async assignPlugin(pluginName: string, agentId: string): Promise<void> {
    this.logger.log(`Assigning plugin ${pluginName} to worker ${agentId}`);

    const pluginsService = new PluginsService();
    const plugin = pluginsService.getPluginByName(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    const worker = this.workers.get(agentId);
    if (!worker) {
      throw new Error(`Worker ${agentId} is unknown`);
    }

    // Reject obviously wrong placements early; if the worker's platform is
    // still unknown (never heartbeated) the agent double-checks on its side.
    if (worker.platform && !isPlatformCompatible(plugin.info.os, plugin.info.cpu, worker.platform.os, worker.platform.arch)) {
      const requirement = describePlatformRequirement(plugin.info.os, plugin.info.cpu);
      throw new Error(`Plugin ${pluginName} requires ${requirement} — worker ${worker.name} is ${worker.platform.os}/${worker.platform.arch}`);
    }

    await pluginsService.setWorkerAgentId(pluginName, agentId);
    this.restartPluginWorker(pluginName);
  }

  public async unassignPlugin(pluginName: string): Promise<void> {
    this.logger.log(`Unassigning plugin ${pluginName}`);

    const pluginsService = new PluginsService();
    await pluginsService.setWorkerAgentId(pluginName, undefined);
    this.restartPluginWorker(pluginName);
  }

  public getPluginAssignment(pluginName: string): string | undefined {
    return new PluginsService().getPluginDbByName(pluginName)?.workerAgentId;
  }

  public getRemotePluginState(pluginName: string): RemotePluginState | undefined {
    const agentId = this.getPluginAssignment(pluginName);
    if (!agentId) {
      return undefined;
    }

    const worker = this.workers.get(agentId);
    if (!worker?.online) {
      return undefined;
    }

    return worker.plugins?.find((plugin) => plugin.id === pluginName)?.state;
  }

  public getRemoteProcess(capability: WorkerCapability, id: string): { worker: string; system?: SystemInfo; sample?: WorkerProcessSample } | undefined {
    const agentId = capability === WorkerCapability.FrameDecoding ? this.getAssignment(id) : this.getPluginAssignment(id);
    if (!agentId) {
      return undefined;
    }

    const worker = this.workers.get(agentId);
    if (!worker) {
      return undefined;
    }

    return {
      worker: worker.name,
      system: worker.system,
      sample: worker.processes?.find((process) => process.capability === capability && process.id === id),
    };
  }

  public getWorkerByName(name: string): WorkerInfo | undefined {
    for (const worker of this.workers.values()) {
      if (worker.name === name) return worker;
    }
    return undefined;
  }

  public async renameWorker(agentId: string, name: string): Promise<void> {
    await this.workersService.renameWorker(agentId, name);

    const worker = this.workers.get(agentId);
    if (worker) {
      worker.name = name;
      this.emitWorkerUpdate(worker);
    }
  }

  public async setServerAddresses(agentId: string, serverAddresses: string[]): Promise<void> {
    const previous = this.workersService.getWorkerServerAddresses(agentId);
    await this.workersService.setWorkerServerAddresses(agentId, serverAddresses);

    const worker = this.workers.get(agentId);
    if (worker) {
      worker.serverAddresses = serverAddresses;
      this.emitWorkerUpdate(worker);
    }

    if (isEqual(previous, serverAddresses, true)) return;

    const pluginsService = new PluginsService();
    for (const plugin of pluginsService.listByAgentId(agentId)) {
      if (!pluginsService.getPluginProcessByName(plugin.pluginName)?.isRemoteWorker) continue;

      this.logger.log(`Server addresses of worker ${worker?.name ?? agentId} changed, restarting plugin ${plugin.pluginName}`);
      this.restartPluginWorker(plugin.pluginName);
    }
  }

  public async removeWorker(agentId: string): Promise<void> {
    this.logger.log(`Removing worker ${agentId}`);

    for (const camera of this.camerasService.listByAgentId(agentId)) {
      await this.camerasService.setWorkerAgentId(camera._id, undefined);
      this.restartFrameWorker(camera._id);
    }

    const pluginsService = new PluginsService();
    for (const plugin of pluginsService.listByAgentId(agentId)) {
      await pluginsService.setWorkerAgentId(plugin.pluginName, undefined);
      this.restartPluginWorker(plugin.pluginName);
    }

    await this.stopListening(agentId);
    this.outdated.delete(agentId);

    const hadCredentials = await this.workersService.revokeCredentials(agentId);
    await this.workersService.forgetWorker(agentId);
    this.workers.delete(agentId);

    try {
      const socketService = container.resolve<SocketService>('socketService');
      socketService.io.of('/workers').emit('worker-removed', { agentId });

      const workersNsp = socketService.namespaces.get('/workers') as WorkersNamespace | undefined;
      workersNsp?.handleWorkerRemoved(agentId);
    } catch {
      // SocketService may not be available yet during startup
    }

    if (hadCredentials) {
      await this.proxyServer.applyLeafNodeAuth();
    }
  }

  public desireFrameDecoding(cameraId: string): string | undefined {
    if (!this.active) {
      return undefined;
    }

    const agentId = this.getAssignment(cameraId);
    if (!agentId || !this.isWorkerOnline(agentId)) {
      return undefined;
    }

    if (!this.configService.config.workers?.address) {
      if (!this.addressWarned) {
        this.addressWarned = true;
        this.logger.warn("workers.address is not configured — remote workers cannot reach this master's streams, running cameras locally");
      }
      return undefined;
    }

    const spec = this.buildRemoteCameraConfig(cameraId);
    if (!spec) {
      return undefined;
    }

    this.desired.set(workloadKey(WorkerCapability.FrameDecoding, cameraId), {
      agentId,
      workload: { id: cameraId, capability: WorkerCapability.FrameDecoding, spec, revision: ++this.workloadRevision },
    });

    this.nudge(agentId);
    return agentId;
  }

  public clearFrameDecoding(cameraId: string): void {
    this.clearWorkload(WorkerCapability.FrameDecoding, cameraId);
  }

  public desirePluginHost(pluginName: string): string | undefined {
    if (!this.active) {
      return undefined;
    }

    const agentId = this.getPluginAssignment(pluginName);
    if (!agentId || !this.isWorkerOnline(agentId)) {
      return undefined;
    }

    const plugin = new PluginsService().getPluginByName(pluginName);
    if (!plugin) {
      return undefined;
    }

    const worker = this.workers.get(agentId);
    if (worker?.platform && !isPlatformCompatible(plugin.info.os, plugin.info.cpu, worker.platform.os, worker.platform.arch)) {
      this.logger.warn(`Plugin ${pluginName} is assigned to worker ${worker.name} but incompatible with its platform — not delegating`);
      return undefined;
    }

    const rtsp = this.configService.go2rtcConfig.rtsp;
    const spec: RemotePluginConfig = {
      pluginId: plugin.id,
      pluginName,
      version: plugin.info.installedVersion ?? 'latest',
      displayName: plugin.displayName,
      loggerLevel: this.configService.config.logger.level,
      rtspUsername: rtsp.username,
      rtspPassword: rtsp.password,
    };

    this.desired.set(workloadKey(WorkerCapability.PluginHost, pluginName), {
      agentId,
      workload: { id: pluginName, capability: WorkerCapability.PluginHost, spec, revision: ++this.workloadRevision },
    });

    this.nudge(agentId);
    return agentId;
  }

  public clearPluginHost(pluginName: string): void {
    this.clearWorkload(WorkerCapability.PluginHost, pluginName);
  }

  private clearWorkload(capability: WorkerCapability, id: string): void {
    const key = workloadKey(capability, id);
    const entry = this.desired.get(key);
    if (!entry) {
      return;
    }

    this.desired.delete(key);
    this.nudge(entry.agentId);
  }

  private createWorkerProxy(agentId: string): Promisify<WorkerAgentRPC> {
    const proxy = this.proxyServer.proxy;
    if (!proxy) {
      throw new Error('Proxy is not initialized');
    }
    const rpcSubject = NamespaceManager.workerAgentRpc(agentId);
    return proxy.createProxy<WorkerAgentRPC>(rpcSubject);
  }

  private async listen(agentId: string): Promise<void> {
    const proxy = this.proxyServer.proxy;
    if (!this.active || !proxy || this.listeners.has(agentId)) {
      return;
    }

    if (!SUBJECT_TOKEN.test(agentId)) {
      this.logger.warn(`Worker ${agentId} has an invalid id, remove it and pair it again`);
      return;
    }

    const listening = (async () => {
      const closeHeartbeat = await proxy.registerHandler(
        NamespaceManager.workerManagerRpc(agentId),
        { heartbeat: (heartbeat: WorkerHeartbeat) => this.handleHeartbeat(agentId, heartbeat) },
        { withoutDecorators: true },
      );
      const unsubscribeDisconnect = await proxy.subscribe(NamespaceManager.workerDisconnect(agentId), (data: { agentId: string }) => {
        this.handleGracefulDisconnect(agentId, data?.agentId);
      });
      const unsubscribeLogs = await proxy.subscribe(NamespaceManager.workerLogs(agentId), (entry: LogEntry) => {
        this.handleForwardedLog(agentId, entry);
      });

      return async () => {
        unsubscribeDisconnect();
        unsubscribeLogs();
        await closeHeartbeat();
      };
    })();

    this.listeners.set(agentId, listening);

    try {
      await listening;
    } catch (error) {
      this.listeners.delete(agentId);
      throw error;
    }
  }

  private async stopListening(agentId: string): Promise<void> {
    const listening = this.listeners.get(agentId);
    this.listeners.delete(agentId);

    const close = await listening?.catch(() => undefined);
    await close?.();
  }

  private probeOutdatedWorkers(): void {
    for (const agentId of this.listeners.keys()) {
      if (this.workers.get(agentId)?.online || this.probing.has(agentId) || this.outdated.has(agentId)) {
        continue;
      }

      this.probing.add(agentId);
      this.createWorkerProxy(agentId)
        .ping()
        .then((health) => {
          if (!health?.version && this.listeners.has(agentId)) {
            this.refuseOutdatedWorker(agentId, health);
          }
        })
        .catch(() => {})
        .finally(() => this.probing.delete(agentId));
    }
  }

  private refuseOutdatedWorker(agentId: string, health: WorkerHealthInfo): void {
    this.outdated.add(agentId);

    const name = this.workers.get(agentId)?.name ?? health.name;
    this.logger.warn(
      `Worker ${name} (${agentId}) runs an older version that this server no longer accepts. Update it to ${ConfigService.RUNNING_VERSION} on its machine.`,
    );

    // it keeps what it ran before while this server already runs that work itself
    if (health.cameras?.length) {
      this.logger.warn(`Restarting worker ${name} (${agentId}), it still runs work that this server has taken over`);
      this.createWorkerProxy(agentId)
        .restart()
        .catch(() => {});
    }
  }

  private nudge(agentId: string): void {
    try {
      this.proxyServer.proxy?.publish(NamespaceManager.workerSync(agentId), {});
    } catch {
      // agent will converge on its next heartbeat anyway
    }
  }

  private restartFrameWorker(cameraId: string): void {
    const api = container.resolve<CameraUiAPI>('api');
    api.cameraControllers
      .get(cameraId)
      ?.frameWorker.restart()
      .catch((error: any) => {
        this.logger.error(`Failed to restart FrameWorker for camera ${cameraId}:`, error);
      });
  }

  private restartPluginWorker(pluginName: string): void {
    new PluginsService()
      .getPluginProcessByName(pluginName)
      ?.restart()
      .catch((error: any) => {
        this.logger.error(`Failed to restart plugin ${pluginName}:`, error);
      });
  }

  private buildRemoteCameraConfig(cameraId: string): RemoteCameraConfig | undefined {
    const api = container.resolve<CameraUiAPI>('api');
    const controller = api.cameraControllers.get(cameraId);
    if (!controller) {
      return undefined;
    }

    return {
      cameraId,
      cameraName: controller.name,
      loggerLevel: this.configService.config.logger.level,
    };
  }

  private handleHeartbeat(agentId: string, heartbeat: WorkerHeartbeat): WorkerSyncResponse {
    if (heartbeat?.agentId !== agentId) {
      this.logger.warn(`Rejected a heartbeat for ${heartbeat?.agentId} from worker ${agentId}`);
      throw new Error(`Worker ${agentId} cannot send a heartbeat for ${heartbeat?.agentId}`);
    }

    this.outdated.delete(agentId);

    const existing = this.workers.get(heartbeat.agentId);
    const versionMismatch = heartbeat.version !== ConfigService.RUNNING_VERSION;

    if (!existing?.online) {
      this.logger.log(`Worker ${existing ? 'reconnected' : 'connected'}: ${heartbeat.name} (${heartbeat.agentId})`);
    }

    if (versionMismatch && !existing?.versionMismatch) {
      const workerVersion = heartbeat.version || 'unknown';
      this.logger.warn(`Worker ${heartbeat.name} (${heartbeat.agentId}) runs version ${workerVersion}, master runs ${ConfigService.RUNNING_VERSION} — update the worker`);
    }

    const wasOffline = !existing?.online;
    const restarted = existing?.online === true && existing.pid !== undefined && existing.pid !== heartbeat.pid;
    if (restarted) {
      this.logger.log(`Worker restarted: ${heartbeat.name} (${heartbeat.agentId}), pid ${existing.pid} -> ${heartbeat.pid}`);
    }

    const workerInfo: WorkerInfo = {
      agentId: heartbeat.agentId,
      name: this.workersService.getWorkerDisplayName(heartbeat.agentId) ?? heartbeat.name,
      online: true,
      lastHeartbeat: Date.now(),
      cameras: heartbeat.cameras,
      capabilities: heartbeat.capabilities ?? [],
      version: heartbeat.version,
      versionMismatch,
      platform: heartbeat.platform,
      addresses: heartbeat.addresses,
      serverAddresses: this.workersService.getWorkerServerAddresses(heartbeat.agentId),
      system: heartbeat.system,
      pid: heartbeat.pid,
      cpuLoad: heartbeat.cpuLoad,
      memLoad: heartbeat.memLoad,
      plugins: heartbeat.plugins,
      processes: heartbeat.processes,
      update: heartbeat.update,
    };

    this.workers.set(heartbeat.agentId, workerInfo);
    this.emitWorkerUpdate(workerInfo);

    this.workersService.rememberWorker(heartbeat.agentId, heartbeat.name).catch(() => {});

    if (wasOffline || restarted) {
      this.onWorkerOnline(heartbeat.agentId);
    }

    return {
      workloads: this.desiredFor(heartbeat.agentId),
      updateChannel: this.configService.config.betaUpdates ? 'beta' : 'latest',
    };
  }

  private desiredFor(agentId: string): WorkloadSpec[] {
    const workloads: WorkloadSpec[] = [];
    for (const entry of this.desired.values()) {
      if (entry.agentId === agentId) {
        workloads.push(entry.workload);
      }
    }
    return workloads;
  }

  private seedKnownWorkers(): void {
    for (const known of this.workersService.listKnownWorkers()) {
      this.workers.set(known.agentId, {
        agentId: known.agentId,
        name: known.displayName ?? known.name,
        serverAddresses: known.serverAddresses,
        online: false,
        lastHeartbeat: known.lastSeen,
        cameras: [],
        capabilities: [],
      });
    }
  }

  private handleGracefulDisconnect(agentId: string, reportedAgentId: string | undefined): void {
    if (reportedAgentId !== agentId) {
      this.logger.warn(`Ignored a disconnect for ${reportedAgentId} from worker ${agentId}`);
      return;
    }

    const worker = this.workers.get(agentId);
    if (!worker?.online) return;

    this.logger.log(`Worker ${worker.name} (${agentId}) disconnected gracefully`);
    worker.online = false;
    this.emitWorkerUpdate(worker);
    this.onWorkerOffline(agentId);
  }

  private checkTimeouts(): void {
    const now = Date.now();

    for (const [agentId, worker] of this.workers) {
      if (worker.online && now - worker.lastHeartbeat > WORKER_TIMEOUT_MS) {
        this.logger.warn(`Worker ${worker.name} (${agentId}) timed out — checking failover`);
        worker.online = false;
        this.emitWorkerUpdate(worker);
        this.onWorkerOffline(agentId);
      }
    }
  }

  private handleForwardedLog(agentId: string, entry: LogEntry): void {
    try {
      const logManager = container.resolve<LogManager>('logManager');
      logManager.handleChildLog(this.scopeForwardedLog(agentId, entry));
    } catch {
      // LogManager may not be available yet during startup
    }
  }

  private scopeForwardedLog(agentId: string, entry: LogEntry): LogEntry {
    const pluginsService = new PluginsService();
    const runsPlugin = (pluginId?: string): boolean => !!pluginId && pluginsService.getPluginDbById(pluginId)?.workerAgentId === agentId;
    const pluginId = runsPlugin(entry.pluginId) ? entry.pluginId : undefined;

    if (entry.targetType === 'plugin' && runsPlugin(entry.targetId)) {
      return { ...entry, pluginId };
    }

    const camera = entry.targetType === 'camera' && entry.targetId ? this.camerasService.findById(entry.targetId) : undefined;
    const servedPlugin = pluginId !== undefined && (camera?.pluginInfo?.id === pluginId || camera?.plugins.some(({ id }) => id === pluginId));
    if (camera && (camera.workerAgentId === agentId || servedPlugin)) {
      return { ...entry, pluginId };
    }

    return { ...entry, pluginId, targetId: undefined, targetType: 'system', suffix: this.workers.get(agentId)?.name ?? agentId };
  }

  private emitWorkerUpdate(worker: WorkerInfo): void {
    try {
      const socketService = container.resolve<SocketService>('socketService');
      socketService.io.of('/workers').emit('worker-update', worker);

      // Push to WorkersNamespace for history accumulation
      const workersNsp = socketService.namespaces.get('/workers') as WorkersNamespace | undefined;
      workersNsp?.handleWorkerUpdate(worker);

      const serverNsp = socketService.namespaces.get('/server') as ServerNamespace | undefined;
      serverNsp?.refreshWorkerUpdateAvailable();
    } catch {
      // SocketService may not be available yet during startup
    }
  }

  private onWorkerOnline(agentId: string): void {
    const api = container.resolve<CameraUiAPI>('api');

    for (const camera of this.camerasService.listByAgentId(agentId)) {
      const controller = api.cameraControllers.get(camera._id);
      if (!controller) continue;

      // Camera is running on a local fallback fork — re-home it to the worker
      // that just came (back) online.
      if (!controller.frameWorker.isRemoteWorker) {
        this.logger.log(`Worker ${agentId} online — re-homing FrameWorker for ${camera.name}`);
        this.restartFrameWorker(camera._id);
      }
    }

    const pluginsService = new PluginsService();
    for (const plugin of pluginsService.listByAgentId(agentId)) {
      const process = pluginsService.getPluginProcessByName(plugin.pluginName);
      if (!process || process.isRemoteWorker) continue;

      this.logger.log(`Worker ${agentId} online — re-homing plugin ${plugin.pluginName}`);
      this.restartPluginWorker(plugin.pluginName);
    }
  }

  private onWorkerOffline(agentId: string): void {
    const api = container.resolve<CameraUiAPI>('api');

    for (const camera of this.camerasService.listByAgentId(agentId)) {
      const controller = api.cameraControllers.get(camera._id);
      if (!controller) continue;

      // Worker gone — restart re-runs placement and falls back to a local fork.
      this.logger.log(`Worker ${agentId} offline — falling back to local FrameWorker for ${camera.name}`);
      this.restartFrameWorker(camera._id);
    }

    const pluginsService = new PluginsService();
    for (const plugin of pluginsService.listByAgentId(agentId)) {
      const process = pluginsService.getPluginProcessByName(plugin.pluginName);
      if (!process?.isRemoteWorker) continue;

      // Restart re-runs placement — falls back to local only if compatible.
      this.logger.log(`Worker ${agentId} offline — re-placing plugin ${plugin.pluginName}`);
      this.restartPluginWorker(plugin.pluginName);
    }
  }
}
