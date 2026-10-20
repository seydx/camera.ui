import fp from 'fastify-plugin';
import { container } from 'tsyringe';
import { WebSocket, WebSocketServer } from 'ws';

import { createSourceName } from '../../utils/camera.js';
import { AuthService } from '../services/auth.service.js';
import { UsersService } from '../services/users.service.js';
import { NatsSubFirewall } from './natsSubFirewall.js';
import { FrameDeflater, isRemoteClient, wantsFrameDeflate, worthCompressing } from './relayCompression.js';

import type { FastifyInstance, FastifyPluginAsync, HookHandlerDoneFunction } from 'fastify';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { ClientOptions, RawData } from 'ws';
import type { ProxyServer } from '../../rpc/index.js';
import type { AuthConfig } from '../../rpc/interfaces/config.js';
import type { LoggerService } from '../../services/logger/index.js';
import type { Database } from '../database/index.js';
import type { DBToken } from '../types/index.js';

export interface ProxyTLSOptions {
  cert: string | Buffer;
  key: string | Buffer;
  ca: string | Buffer;
  rejectUnauthorized?: boolean;
}

export interface ProxyOptions {
  upstream: string;
  prefix: string;
  target: 'nats' | 'go2rtc';
  tls?: ProxyTLSOptions;
}

const GO2RTC_VIEWER_MESSAGES = new Set(['mse', 'mse/stop', 'mp4', 'hls', 'mjpeg', 'webcodecs', 'webrtc/offer', 'webrtc/candidate', 'talkback']);

function isValidCloseCode(code: number): boolean {
  return (code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006) || (code >= 3000 && code <= 4999);
}

class WebSocketProxy {
  private wss: WebSocketServer;
  private wssDeflate?: WebSocketServer;
  private wssRefusal: WebSocketServer;
  private upstream: string;
  private upstreamHost: string;
  private prefix: string;
  private target: 'nats' | 'go2rtc';
  private tlsConfig?: ProxyTLSOptions;
  private authService: AuthService;
  private usersService: UsersService;
  private proxy: ProxyServer;
  private logger: LoggerService;
  private dbs: Database;

  constructor(fastify: FastifyInstance, options: ProxyOptions) {
    this.proxy = container.resolve<ProxyServer>('proxy');
    this.logger = container.resolve<LoggerService>('logger');
    this.dbs = container.resolve<Database>('dbs');
    this.authService = new AuthService();
    this.usersService = new UsersService();

    this.upstream = options.upstream;
    this.upstreamHost = new URL(options.upstream).host;
    this.prefix = options.prefix;
    this.target = options.target;
    this.tlsConfig = options.tls;

    this.wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate: false,
    });

    // video does not compress; context takeover stays on, without it small replies stop compressing
    if (this.target === 'nats') {
      this.wssDeflate = new WebSocketServer({
        noServer: true,
        maxPayload: NATS_MAX_CLIENT_FRAME,
        perMessageDeflate: { zlibDeflateOptions: { level: 1, chunkSize: 64 * 1024 } },
      });
    }

    // passed as a variable: @types/ws does not know closeTimeout yet
    const refusalOptions = { noServer: true, perMessageDeflate: false, clientTracking: false, closeTimeout: REFUSAL_CLOSE_TIMEOUT_MS };
    this.wssRefusal = new WebSocketServer(refusalOptions);

    this.heartbeat = setInterval(() => this.checkClients(), HEARTBEAT_MS).unref();

    fastify.server.on('upgrade', async (request, socket, head) => {
      if (request.url?.startsWith(this.prefix)) {
        await this.handleUpgrade(request, socket, head);
      }
    });
  }

  public close(): void {
    this.wss.removeAllListeners();
    this.wss.close();
    this.wssDeflate?.removeAllListeners();
    this.wssDeflate?.close();
    this.wssRefusal.removeAllListeners();
    this.wssRefusal.close();
  }

  private async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    try {
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token') ?? '';

      const resolved = this.authService.resolveAccessToken(token);
      if (!resolved) {
        this.reject(request, socket, head, 4401, 'unauthorized: unknown token', token);
        return;
      }

      const dbToken = resolved.token;
      if (resolved.via === 'current' && dbToken.type !== 'api' && dbToken.access_token_expires_at !== undefined && dbToken.access_token_expires_at < Date.now()) {
        this.reject(request, socket, head, 4401, 'unauthorized: token expired', token);
        return;
      }

      let targetUrl = this.upstream;
      let natsCreds: AuthConfig = this.proxy.auth.server;
      let firewallConnId: string | null = null;
      let firewallUserId: string | undefined;
      let go2rtcViewer = false;

      if (this.target === 'go2rtc') {
        const src = url.searchParams.get('src') ?? '';
        go2rtcViewer = this.isGo2rtcViewer(dbToken);
        const denied = this.go2rtcSrcDenial(dbToken, src, go2rtcViewer);
        if (denied) {
          this.reject(request, socket, head, 4403, denied, token);
          return;
        }
        targetUrl += `?src=${encodeURIComponent(src)}`;

        if (dbToken.user_id.startsWith(SHARE_USER_PREFIX)) {
          targetUrl += `&tag=${encodeURIComponent(dbToken.user_id)}`;
        }
      } else if (this.target === 'nats') {
        if (dbToken.stream_scope || dbToken.user_id.startsWith(SHARE_USER_PREFIX)) {
          this.reject(request, socket, head, 4403, 'forbidden: token not allowed on rpc bus', token);
          return;
        }

        const isAdmin = this.isAdmin(dbToken.user_id);
        natsCreds = isAdmin ? this.proxy.auth.server : this.proxy.auth.viewer;

        if (!isAdmin) {
          const connId = url.searchParams.get('connId') ?? '';
          if (!/^[A-Za-z0-9_-]{8,128}$/.test(connId)) {
            this.reject(request, socket, head, 4400, 'bad request: missing or invalid connId', token);
            return;
          }
          firewallConnId = connId;
          firewallUserId = dbToken.user_id;
        }
      }

      let endsAt: number | undefined;
      if (dbToken.user_id.startsWith(SHARE_USER_PREFIX)) {
        const share = this.dbs.sharesDB.get(dbToken.user_id.slice(SHARE_USER_PREFIX.length));
        endsAt = share && !share.revoked ? Date.parse(share.expiresAt) : undefined;
        if (!share || !endsAt || endsAt <= Date.now()) {
          this.reject(request, socket, head, ...SHARE_ENDED, token);
          return;
        }
        if (this.shareSeatsTaken(dbToken) >= Math.min(share.maxViewers || MAX_RELAYS_PER_SHARE, MAX_RELAYS_PER_SHARE)) {
          this.reject(request, socket, head, 4429, 'share full', token);
          return;
        }
        this.relays.closeTokens([dbToken.id], [4403, 'forbidden: replaced by a newer connection']);
      } else if (!this.hasRelaySlot(dbToken.id)) {
        this.reject(request, socket, head, ...TOO_MANY_RELAYS, token);
        return;
      }

      const wsOptions: ClientOptions = {
        perMessageDeflate: false,
        handshakeTimeout: UPSTREAM_HANDSHAKE_TIMEOUT_MS,
        // a Mozilla/ user agent makes nats-server cut messages into 4 KB frames
        headers: { host: this.upstreamHost, 'user-agent': 'camera.ui-relay' },
        ca: this.tlsConfig?.ca,
        cert: this.tlsConfig?.cert,
        key: this.tlsConfig?.key,
        rejectUnauthorized: this.tlsConfig?.rejectUnauthorized,
      };

      const serverWs = new WebSocket(targetUrl, wsOptions);

      await new Promise<void>((resolve, reject) => {
        serverWs.once('open', resolve);
        serverWs.once('error', reject);
      });

      this.wss.handleUpgrade(request, socket, head, (clientWs) => {
        this.proxyWebSockets(clientWs, serverWs, natsCreds, firewallConnId, firewallUserId, go2rtcViewer);
      });
    } catch (err) {
      this.logger.warn(`Proxy upgrade failed (500) target=${this.target}: ${(err as Error)?.message ?? err}`);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  }

  private proxyWebSockets(
    client: WebSocket,
    server: WebSocket,
    natsCreds: AuthConfig,
    firewallConnId: string | null,
    firewallUserId: string | undefined,
    go2rtcViewer: boolean,
    early: [RawData, boolean][],
    deflater?: FrameDeflater,
  ): void {
    if (firewallConnId) {
      const firewall = new NatsSubFirewall(
        firewallConnId,
        {
          forward: (chunk) => {
            if (server.readyState === WebSocket.OPEN) server.send(chunk, { binary: true });
          },
          close: (reason) => {
            this.logger.warn(`RPC firewall closed connection (connId ${firewallConnId}): ${reason}`);
            if (client.readyState === WebSocket.OPEN) client.close(4403, `forbidden: ${reason}`.slice(0, 123));
            if (server.readyState === WebSocket.OPEN) server.close(1000);
          },
          rewriteConnect: (connectData) => this.applyNatsCreds(connectData, natsCreds),
        },
        firewallUserId,
      );

      client.on('message', (data) => {
        if (server.readyState !== WebSocket.OPEN) return;
        firewall.push(this.toBuffer(data));
      });
    } else {
      let connectHandled = false;

      client.on('message', (data, isBinary) => {
        if (server.readyState !== WebSocket.OPEN) return;

        if (go2rtcViewer && !isBinary) {
          const message = this.viewerMessage(data);
          if (!message) {
            this.logger.warn('Proxy closed go2rtc viewer connection (4403): message type not allowed');
            server.close(1000);
            client.close(4403, 'forbidden: message type not allowed');
            return;
          }
          server.send(message);
          return;
        }

        if (!connectHandled && this.target === 'nats') {
          connectHandled = true;
          try {
            const msg = this.extractMessage(data);
            if (msg.startsWith('CONNECT ')) {
              const connectData = this.applyNatsCreds(JSON.parse(msg.slice(8)), natsCreds);
              server.send(Buffer.from(`CONNECT ${JSON.stringify(connectData)}\r\n`), { binary: isBinary });
              return;
            }
          } catch {
            // Not a parseable CONNECT — forward as-is
          }
        }

        server.send(data, { binary: isBinary });
      });
    }

    client.on('ping', (data) => server.readyState === WebSocket.OPEN && server.ping(data));
    client.on('pong', (data) => server.readyState === WebSocket.OPEN && server.pong(data));

    client.on('close', (code, reason) => {
      if (server.readyState === WebSocket.OPEN) {
        server.close(isValidCloseCode(code) ? code : 1000, reason);
      }
    });

    client.on('error', () => {
      if (server.readyState === WebSocket.OPEN) server.close(1011);
    });

    server.on('message', (data, isBinary) => {
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(data, { binary: isBinary });
    });

    server.on('ping', (data) => client.readyState === WebSocket.OPEN && client.ping(data));
    server.on('pong', (data) => client.readyState === WebSocket.OPEN && client.pong(data));

    server.on('close', (code, reason) => {
      const close = (): void => {
        if (client.readyState !== WebSocket.OPEN) return;
        // an abnormal upstream close must not read as clean, 4500 makes the client retry
        client.close(isValidCloseCode(code) ? code : 4500, isValidCloseCode(code) ? reason : reason?.length ? reason : 'upstream lost');
      };
      if (deflater) deflater.whenDrained(close);
      else close();
    });

    server.on('error', () => {
      if (client.readyState === WebSocket.OPEN) client.close(1011);
    });
  }

  private reject(request: IncomingMessage, socket: Duplex, head: Buffer, code: number, reason: string, token: string): void {
    this.logger.warn(`Proxy rejected (${code}) target=${this.target} token=${token.slice(0, 8)}… — ${reason}`);
    this.wss.handleUpgrade(request, socket, head, (clientWs) => {
      clientWs.close(code, reason);
    });
  }

  private isAdmin(userId: string): boolean {
    const role = this.usersService.findById(userId)?.role;
    return role === 'admin' || role === 'master';
  }

  private isGo2rtcViewer(dbToken: DBToken): boolean {
    return Boolean(dbToken.stream_scope) || dbToken.user_id.startsWith(SHARE_USER_PREFIX) || !this.isAdmin(dbToken.user_id);
  }

  private go2rtcSrcDenial(dbToken: DBToken, src: string, viewer: boolean): string | undefined {
    if (dbToken.stream_scope || dbToken.user_id.startsWith(SHARE_USER_PREFIX)) {
      return src && src === dbToken.stream_scope ? undefined : 'forbidden: src out of scope';
    }
    if (!viewer || this.isCameraStream(src)) {
      return undefined;
    }
    return 'forbidden: src is not a camera stream';
  }

  private viewerMessage(data: RawData): string | undefined {
    let message: { type?: unknown; value?: unknown } | null;
    try {
      message = JSON.parse(this.extractMessage(data));
    } catch {
      return undefined;
    }
    if (typeof message?.type !== 'string' || !GO2RTC_VIEWER_MESSAGES.has(message.type)) {
      return undefined;
    }
    return JSON.stringify({ type: message.type, value: message.value });
  }

  private isCameraStream(src: string): boolean {
    for (const { value: camera } of this.dbs.camerasDB.getRange()) {
      if (camera.sources.some((source) => createSourceName(camera.name, source.name) === src)) {
        return true;
      }
    }
    return false;
  }

  private extractMessage(data: RawData): string {
    if (Buffer.isBuffer(data)) return data.toString('utf-8');
    if (Array.isArray(data)) return Buffer.concat(data).toString('utf-8');
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8');
    throw new Error('Unsupported data type');
  }

  private toBuffer(data: RawData): Buffer {
    if (Buffer.isBuffer(data)) return data;
    if (Array.isArray(data)) return Buffer.concat(data);
    return Buffer.from(data);
  }

  private applyNatsCreds(connectData: Record<string, unknown>, natsCreds: AuthConfig): Record<string, unknown> {
    connectData.user = natsCreds.user;
    connectData.pass = natsCreds.password;
    // TLS handled at transport layer, not in CONNECT message
    delete connectData.tls;
    return connectData;
  }
}

export const ProxyPlugin: FastifyPluginAsync<ProxyOptions> = fp(async (app: FastifyInstance, options: ProxyOptions) => {
  if (!options.upstream) {
    throw new Error('upstream must be specified');
  }

  const ws = new WebSocketProxy(app, options);

  app.addHook('preClose', (done: HookHandlerDoneFunction) => {
    ws.close();
    done();
  });
});
