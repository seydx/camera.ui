import { createHash, timingSafeEqual } from 'node:crypto';

import { inject } from '../container.js';
import { PROXY_AUTH_DEVICE_PREFIX } from '../services/config/constants.js';
import { addressList, listsAddress } from '../utils/trusted-addresses.js';
import { IngressSession } from './ingress.js';
import { UsersService } from './services/users.service.js';

import type { IncomingHttpHeaders } from 'node:http';
import type { BlockList } from 'node:net';
import type { ProxyAuthSettings } from '../services/config/proxy-auth.js';
import type { SessionProfile } from './ingress.js';

export const PROXY_SECRET_HEADER = 'x-proxy-secret';
export const PROXY_AUTH_HEADER = 'x-cui-auth';

const PROXY_SESSION: SessionProfile = { devicePrefix: PROXY_AUTH_DEVICE_PREFIX, deviceName: 'Reverse proxy', replaces: 'own' };
const REFUSAL_LOG_INTERVAL_MS = 60 * 1000;
const REFUSAL_LOG_KEYS = 256;

export type ProxySignIn = { token: string } | { refused: string };

export class ProxyAuth {
  public readonly header: string;
  public readonly ownHeaders: ReadonlySet<string>;

  private readonly logger = inject('logger');
  private readonly usersService = new UsersService();
  private readonly trusted: BlockList;
  private readonly secret?: Buffer;
  private readonly sessions = new Map<string, IngressSession>();
  private readonly refusals = new Map<string, number>();

  constructor(private readonly settings: ProxyAuthSettings) {
    this.header = settings.header;
    this.ownHeaders = new Set([settings.header, PROXY_SECRET_HEADER, PROXY_AUTH_HEADER]);
    this.trusted = addressList(settings.trust);
    this.secret = settings.secret ? digest(settings.secret) : undefined;
  }

  public isTrusted(address: string | undefined): boolean {
    if (this.settings.trust.length === 0 || listsAddress(this.trusted, address)) return true;
    const peer = shown(address);
    this.refuse(`peer ${peer}`, `Proxy sign-in refused a connection from ${peer}, the address is not trusted`);
    return false;
  }

  public async signIn(address: string | undefined, headers: IncomingHttpHeaders): Promise<ProxySignIn | undefined> {
    if (!this.isTrusted(address)) {
      return { refused: 'This address may not use the proxy sign-in.' };
    }
    if (this.secret && !this.carriesSecret(headers[PROXY_SECRET_HEADER])) {
      this.refuse(`secret ${shown(address)}`, `Proxy sign-in refused a request from ${shown(address)} without the proxy secret`);
      return { refused: 'The reverse proxy did not send its secret.' };
    }

    const name = headers[this.header];
    if (typeof name !== 'string' || !name) {
      return undefined;
    }

    const user = this.usersService.findByName(name);
    if (!user) {
      this.refuse(`user ${name}`, `Proxy sign-in: there is no camera.ui user named ${JSON.stringify(name)}`);
      return { refused: 'Your reverse proxy signed you in, but camera.ui has no user with this name.' };
    }

    let session = this.sessions.get(user._id);
    if (!session) {
      session = new IngressSession(() => this.usersService.findById(user._id), PROXY_SESSION);
      this.sessions.set(user._id, session);
    }
    const token = await session.getAccessToken();
    return token ? { token } : { refused: 'camera.ui could not sign you in.' };
  }

  private carriesSecret(value: string | string[] | undefined): boolean {
    return typeof value === 'string' && timingSafeEqual(digest(value), this.secret!);
  }

  private refuse(key: string, message: string): void {
    const now = Date.now();
    if (now - (this.refusals.get(key) ?? 0) < REFUSAL_LOG_INTERVAL_MS) return;
    if (this.refusals.size >= REFUSAL_LOG_KEYS) this.refusals.clear();
    this.refusals.set(key, now);
    this.logger.warn(message);
  }
}

function shown(address: string | undefined): string {
  return address?.replace(/^::ffff:/, '') ?? 'an unknown address';
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
