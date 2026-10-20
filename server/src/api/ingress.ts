import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

import { inject } from '../container.js';
import { INGRESS_DEVICE_PREFIX, INGRESS_USERNAME } from '../services/config/constants.js';
import { ingressUser } from './database/index.js';
import { AuthService } from './services/auth.service.js';
import { UsersService } from './services/users.service.js';
import { TOKEN_LIFETIME } from './types/index.js';

import type { IncomingHttpHeaders } from 'node:http';
import type { DBUser } from './database/types.js';

const REFRESH_MARGIN_MS = 60 * 1000;
const HA_CORE_URL = 'ws://supervisor/core/websocket';
const HA_CORE_TIMEOUT_MS = 10 * 1000;
const HA_USERS_TTL_MS = 60 * 1000;
const HA_USERS_MAX_AGE_MS = 5 * 60 * 1000;
const HA_USERS_RETRY_MS = 5 * 1000;
const HA_ADMIN_GROUP = 'system-admin';
const HA_USER_HEADER = 'x-remote-user-id';
const INGRESS_SESSION: SessionProfile = { devicePrefix: INGRESS_DEVICE_PREFIX, deviceName: 'Home Assistant Ingress', replaces: 'all' };

export interface HomeAssistantUser {
  id: string;
  username?: string | null;
  name?: string | null;
  is_owner?: boolean;
  is_active?: boolean;
  group_ids?: string[];
}

export interface SessionProfile {
  devicePrefix: string;
  deviceName: string;
  replaces: 'all' | 'own';
}

type UserLookup = () => DBUser | undefined | Promise<DBUser | undefined>;
type UsersListener = (users: ReadonlyMap<string, HomeAssistantUser>) => void;

interface CoreMessage {
  id?: number;
  type?: string;
  success?: boolean;
  result?: unknown;
  message?: string;
  error?: { message?: string };
}

export class IngressSession {
  private readonly configService = inject('configService');
  private readonly authService = new AuthService();
  private readonly usersService = new UsersService();

  private accessToken?: string;
  private tokenId?: string;
  private userId?: string;
  private expiresAt = 0;
  private minting?: Promise<string | undefined>;

  constructor(
    private readonly lookupUser?: UserLookup,
    private readonly profile = INGRESS_SESSION,
  ) {}

  public async getAccessToken(): Promise<string | undefined> {
    if (this.isCachedTokenLive()) {
      return this.accessToken;
    }
    this.minting ??= this.mint().finally(() => {
      this.minting = undefined;
    });
    return this.minting;
  }

  private isCachedTokenLive(): boolean {
    if (!this.accessToken || !this.tokenId || Date.now() >= this.expiresAt - REFRESH_MARGIN_MS) {
      return false;
    }
    return this.authService.findById(this.tokenId)?.access_token === this.accessToken;
  }

  private async mint(): Promise<string | undefined> {
    const user =
      (this.userId ? this.usersService.findById(this.userId) : undefined) ??
      (await (this.lookupUser ? this.lookupUser() : this.usersService.findByName(INGRESS_USERNAME)));
    if (!user) {
      return undefined;
    }
    this.userId = user._id;

    if (this.tokenId) {
      await this.authService.invalidateById(this.tokenId).catch(() => {});
    } else {
      await this.replaceEarlier(user._id).catch(() => {});
    }

    const deviceId = `${this.profile.devicePrefix}${randomUUID()}`;
    const accessToken = jwt.sign({ _id: user._id, username: user.username, device_id: deviceId }, this.configService.SECRETS.jwtAccessKey, {
      expiresIn: TOKEN_LIFETIME.ACCESS_SECONDS,
    });

    const token = this.authService.createToken({
      userId: user._id,
      accessToken,
      persistent: true,
      kind: 'web',
      deviceId,
      deviceName: this.profile.deviceName,
      userAgent: '',
      ip: '127.0.0.1',
    });
    await this.authService.insert(token);

    this.accessToken = token.access_token;
    this.tokenId = token.id;
    this.expiresAt = Date.now() + TOKEN_LIFETIME.ACCESS_SECONDS * 1000;

    return this.accessToken;
  }

  private async replaceEarlier(userId: string): Promise<void> {
    if (this.profile.replaces === 'all') {
      await this.authService.invalidateSessionsByUserId(userId);
      return;
    }
    const own = this.authService.listSessionsByUserId(userId).filter((token) => token.device.id.startsWith(this.profile.devicePrefix));
    await Promise.all(own.map((token) => this.authService.invalidateById(token.id)));
  }
}

export class HomeAssistantUsers {
  private readonly logger = inject('logger');

  private users = new Map<string, HomeAssistantUser>();
  private fetchedAt = 0;
  private attemptedAt = 0;
  private failing = false;
  private loading?: Promise<void>;
  private listener?: UsersListener;

  constructor(
    private readonly url = HA_CORE_URL,
    private readonly token = process.env.SUPERVISOR_TOKEN,
    private readonly timeoutMs = HA_CORE_TIMEOUT_MS,
  ) {
    if (!token) this.logger.warn('Ingress: SUPERVISOR_TOKEN is not set, Home Assistant users are not signed in automatically');
  }

  public async find(id: string): Promise<HomeAssistantUser | undefined> {
    const known = this.current()?.get(id);
    if (known) {
      if (Date.now() - this.fetchedAt >= HA_USERS_TTL_MS) this.refresh();
      return known;
    }
    await this.refresh();
    return this.current()?.get(id);
  }

  public onList(listener: UsersListener): void {
    this.listener = listener;
  }

  private current(): Map<string, HomeAssistantUser> | undefined {
    return Date.now() - this.fetchedAt < HA_USERS_MAX_AGE_MS ? this.users : undefined;
  }

  private refresh(): Promise<void> {
    if (this.loading) return this.loading;
    if (!this.token || Date.now() - this.attemptedAt < HA_USERS_RETRY_MS) return Promise.resolve();

    this.attemptedAt = Date.now();
    this.loading = listHomeAssistantUsers(this.url, this.token, this.timeoutMs)
      .then((users) => {
        this.users = new Map(users.map((user) => [user.id, user]));
        this.fetchedAt = Date.now();
        this.failing = false;
        this.listener?.(this.users);
      })
      .catch((error: Error) => {
        if (!this.failing) this.logger.warn(`Ingress: could not read the Home Assistant users: ${error.message}`);
        this.failing = true;
      })
      .finally(() => {
        this.loading = undefined;
      });
    return this.loading;
  }
}

export class IngressAuth {
  private readonly logger = inject('logger');
  private readonly authService = new AuthService();
  private readonly usersService = new UsersService();
  private readonly master = new IngressSession();
  private readonly viewers = new Map<string, IngressSession>();

  constructor(
    private readonly trustIp: string,
    private readonly haUsers = new HomeAssistantUsers(),
  ) {
    haUsers.onList((users) => {
      this.revokeGone(users).catch((error: Error) => this.logger.warn(`Ingress: could not sign out removed Home Assistant users: ${error.message}`));
    });
  }

  public isTrusted(address: string | undefined): boolean {
    return address?.replace(/^::ffff:/, '') === this.trustIp;
  }

  public async accessToken(address: string | undefined, headers: IncomingHttpHeaders): Promise<string | undefined> {
    const haUserId = headers[HA_USER_HEADER];
    if (!this.isTrusted(address) || typeof haUserId !== 'string' || !haUserId) {
      return undefined;
    }

    const haUser = await this.haUsers.find(haUserId);
    if (!haUser) {
      return undefined;
    }
    if (isHomeAssistantAdmin(haUser)) {
      return this.master.getAccessToken();
    }
    if (!haUser.is_active) {
      return undefined;
    }

    let session = this.viewers.get(haUser.id);
    if (!session) {
      session = new IngressSession(() => this.viewerUser(haUser));
      this.viewers.set(haUser.id, session);
    }
    return session.getAccessToken();
  }

  private async revokeGone(haUsers: ReadonlyMap<string, HomeAssistantUser>): Promise<void> {
    const viewers = new Set<string>();
    for (const haUser of haUsers.values()) {
      if (haUser.is_active && !isHomeAssistantAdmin(haUser)) viewers.add(viewerUserId(haUser.id));
    }
    for (const haUserId of this.viewers.keys()) {
      if (!viewers.has(viewerUserId(haUserId))) this.viewers.delete(haUserId);
    }

    // tokens outlive a restart and also name viewers this run never saw
    const gone = new Map<string, string>();
    for (const token of this.authService.listTokens()) {
      if (token.type === 'api' || !token.device.id.startsWith(INGRESS_DEVICE_PREFIX) || viewers.has(token.user_id) || gone.has(token.user_id)) continue;
      const user = this.usersService.findById(token.user_id);
      if (user?.role !== 'master') gone.set(token.user_id, user?.username ?? token.user_id);
    }
    if (gone.size === 0) {
      return;
    }

    await this.authService.revokeUsers([...gone.keys()], { apiTokens: true });
    this.logger.log(`Ingress: signed out ${[...gone.values()].map((name) => `"${name}"`).join(', ')}, Home Assistant removed or changed the user`);
  }

  private async viewerUser(haUser: HomeAssistantUser): Promise<DBUser> {
    const id = viewerUserId(haUser.id);
    const existing = this.usersService.findById(id);
    if (existing) {
      return existing;
    }

    const user = ingressUser(this.viewerUsername(haUser), 'user', id);
    this.logger.log(`Ingress: added the camera.ui user "${user.username}" for a Home Assistant user without admin rights`);
    return this.usersService.createUser(user);
  }

  private viewerUsername(haUser: HomeAssistantUser): string {
    const label = (haUser.username ?? haUser.name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '');
    const name = `ha-${label || haUser.id.slice(0, 8)}`;
    return this.usersService.findByName(name) ? `${name}-${haUser.id.slice(0, 6)}` : name;
  }
}

export function isHomeAssistantAdmin(user: HomeAssistantUser): boolean {
  return !!user.is_owner || (!!user.is_active && !!user.group_ids?.includes(HA_ADMIN_GROUP));
}

function viewerUserId(haUserId: string): string {
  const hex = createHash('sha256').update(`homeassistant-ingress:${haUserId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function listHomeAssistantUsers(url: string, token: string, timeoutMs: number): Promise<HomeAssistantUser[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { handshakeTimeout: timeoutMs });
    const timer = setTimeout(() => finish(new Error('no answer')), timeoutMs);

    const finish = (error?: Error, users?: HomeAssistantUser[]) => {
      clearTimeout(timer);
      ws.removeAllListeners();
      ws.on('error', () => {});
      if (ws.readyState === WebSocket.OPEN) ws.close();
      else ws.terminate();
      if (error) reject(error);
      else resolve(users ?? []);
    };

    ws.on('message', (data) => {
      let message: CoreMessage;
      try {
        message = JSON.parse((Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data)).toString());
      } catch {
        finish(new Error('unreadable answer'));
        return;
      }

      if (message.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      } else if (message.type === 'auth_ok') {
        ws.send(JSON.stringify({ id: 1, type: 'config/auth/list' }));
      } else if (message.type === 'auth_invalid') {
        finish(new Error(`access denied (${message.message ?? 'auth_invalid'})`));
      } else if (message.type === 'result' && message.id === 1) {
        if (message.success && Array.isArray(message.result)) finish(undefined, message.result as HomeAssistantUser[]);
        else finish(new Error(message.error?.message ?? 'user list refused'));
      }
    });
    ws.on('error', (error) => finish(error));
    ws.on('close', () => finish(new Error('connection closed')));
  });
}
