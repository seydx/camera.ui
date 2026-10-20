import { UsersService } from '../api/services/users.service.js';
import { inject, tryInject } from '../container.js';

import type { ProxyServer } from '../rpc/index.js';
import type { LoggerService } from '../services/logger/index.js';

interface CastPresence {
  deviceId: string;
  name: string;
}

export interface CastTarget {
  deviceId: string;
  name: string;
  lastSeen: number;
}

export interface CastCommand {
  cameraId: string;
  startMs?: number;
}

const PRESENCE_SUBJECT = 'cast.presence';
const PRESENCE_TTL_MS = 75_000;
const SWEEP_INTERVAL_MS = 15_000;

export class CastManager {
  private proxyServer: ProxyServer;
  private logger: LoggerService;
  private usersService: UsersService;

  private targets = new Map<string, CastTarget>();
  private closePresenceUnsub?: () => void;
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.proxyServer = inject('proxy');
    this.logger = inject('logger');
    this.usersService = new UsersService();
  }

  public async register(): Promise<void> {
    try {
      this.closePresenceUnsub = await this.proxyServer.proxy.subscribe<CastPresence>(PRESENCE_SUBJECT, (msg) => {
        if (!msg?.deviceId || !msg?.name) return;
        const known = this.targets.get(msg.deviceId);
        this.targets.set(msg.deviceId, { deviceId: msg.deviceId, name: msg.name, lastSeen: Date.now() });
        if (known?.name !== msg.name) this.broadcast();
      });
    } catch (err) {
      this.logger.warn(`cast presence subscribe failed: ${(err as Error).message}`);
    }
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
  }

  public async destroy(): Promise<void> {
    this.closePresenceUnsub?.();
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  public listTargets(): CastTarget[] {
    const now = Date.now();
    return [...this.targets.values()].filter((t) => now - t.lastSeen < PRESENCE_TTL_MS);
  }

  public async cast(deviceId: string, command: CastCommand): Promise<boolean> {
    if (!this.listTargets().some((t) => t.deviceId === deviceId)) return false;
    await this.proxyServer.proxy.publish(`cast.device.${deviceId}`, { type: 'openPlayer', ...command });
    return true;
  }

  private sweep(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, target] of this.targets) {
      if (now - target.lastSeen >= PRESENCE_TTL_MS) {
        this.targets.delete(id);
        changed = true;
      }
    }
    if (changed) this.broadcast();
  }

  private broadcast(): void {
    const payload = this.listTargets();
    const socketService = tryInject('socketService');
    if (!socketService) return;
    for (const user of this.usersService.list()) {
      if (user.role !== 'admin' && user.role !== 'master') continue;
      socketService.io.of('/notifications').to(`user:${user._id}`).emit('castTargets', payload);
    }
  }
}
