import { container } from 'tsyringe';

import type { CameraUiAPI } from './api.js';
import type { Database } from './api/database/index.js';
import type { Server } from './api/index.js';
import type { RelayRegistry } from './api/plugins/proxy.plugin.js';
import type { BackupSchedulerService } from './api/services/backupScheduler.service.js';
import type { SocketService } from './api/websocket/index.js';
import type { AssistantManager } from './assistant/manager.js';
import type { AutomationEngine } from './automations/engine.js';
import type { Go2RtcApi } from './go2rtc/api/index.js';
import type { Go2Rtc } from './go2rtc/index.js';
import type { Go2RtcState } from './go2rtc/state.js';
import type { InternalEventBus } from './internal-bus.js';
import type { TrainingCandidateManager } from './manager/trainingCandidateManager.js';
import type { CameraUi } from './master.js';
import type { MqttManager } from './mqtt/manager.js';
import type { PluginManager } from './plugins/index.js';
import type { RemoteAccessManager } from './remote/index.js';
import type { CloudApi } from './remote/api/index.js';
import type { TunnelClient } from './remote/tunnel/client.js';
import type { ProxyServer } from './rpc/index.js';
import type { NATS } from './rpc/server.js';
import type { SensorRegistry } from './sensors/registry.js';
import type { ConfigService } from './services/config/index.js';
import type { LoggerService } from './services/logger/index.js';
import type { LogManager } from './services/logger/logManager.js';
import type { WorkerManager } from './workers/manager.js';

interface Services {
  api: CameraUiAPI;
  assistantManager: AssistantManager;
  automationEngine: AutomationEngine;
  backupScheduler: BackupSchedulerService;
  cameraui: CameraUi;
  cloudApi: CloudApi;
  configService: ConfigService;
  dbs: Database;
  go2rtc: Go2Rtc;
  go2rtcApi: Go2RtcApi;
  go2rtcState: Go2RtcState;
  internalBus: InternalEventBus;
  logManager: LogManager;
  logger: LoggerService;
  mqttManager: MqttManager;
  natsServer: NATS;
  pluginManager: PluginManager;
  proxy: ProxyServer;
  relayRegistry: RelayRegistry;
  remoteAccessManager: RemoteAccessManager;
  sensorRegistry: SensorRegistry;
  server: Server;
  socketService: SocketService;
  trainingCandidateManager: TrainingCandidateManager;
  tunnelClient: TunnelClient;
  workerManager: WorkerManager;
}

export function provide<K extends keyof Services>(token: K, instance: Services[K]): void {
  container.registerInstance(token, instance);
}

export function inject<K extends keyof Services>(token: K): Services[K] {
  return container.resolve(token);
}

export function tryInject<K extends keyof Services>(token: K): Services[K] | undefined {
  return container.isRegistered(token) ? container.resolve(token) : undefined;
}
