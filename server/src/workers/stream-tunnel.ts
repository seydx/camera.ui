import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createConnection, createServer, isIP } from 'node:net';
import { connect as connectTls } from 'node:tls';

import type { Logger } from '@camera.ui/common/logger';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo, Server, Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import type { TLSSocket } from 'node:tls';
import type { HostPort } from './types.js';

const TUNNEL_PATH = '/api/workers/tunnel/';
const TUNNEL_PROTOCOL = 'cameraui-tunnel';
const DIAL_TIMEOUT_MS = 10_000;
const MAX_HEAD_BYTES = 4096;

const IDLE_CLOSE_MS = 10 * 60_000;

const URL_AUTHORITY = /^([a-z][a-z0-9+.-]*:\/\/)([^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)(?::(\d+))?/i;
const DEFAULT_PORTS: Record<string, number> = { 'rtsp://': 554, 'rtsps://': 322, 'rtmp://': 1935, 'http://': 80, 'https://': 443 };

type OpenTunnel = (target: HostPort, token: string) => Promise<void>;

interface Listener {
  key: string;
  server: Server;
  port: number;
  target: HostPort;
  open: OpenTunnel;
  connections: Set<() => void>;
  idleTimer?: NodeJS.Timeout;
}

interface Waiting {
  listener: Listener;
  socket: Socket;
  timer: NodeJS.Timeout;
}

export class StreamTunnels {
  private listeners = new Map<string, Listener>();
  private waiting = new Map<string, Waiting>();

  constructor(private logger: Logger) {}

  public async listen(key: string, target: HostPort, host: string, open: OpenTunnel): Promise<HostPort> {
    let listener = this.listeners.get(key);
    if (!listener) {
      listener = await this.openListener(key, target, open);
      const raced = this.listeners.get(key);
      if (raced) {
        listener.server.close();
        listener = raced;
      } else {
        this.listeners.set(key, listener);
        this.logger.log(`go2rtc reaches ${hostPort(target)} on ${host} through 127.0.0.1:${listener.port}`);
      }
    }
    listener.open = open;
    this.armIdle(listener);
    return { host: '127.0.0.1', port: listener.port };
  }

  public accept(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    if (!req.url?.startsWith(TUNNEL_PATH) || req.headers.upgrade?.toLowerCase() !== TUNNEL_PROTOCOL) {
      return false;
    }

    const token = req.url.slice(TUNNEL_PATH.length);
    const waiting = this.waiting.get(token);
    if (!waiting) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return true;
    }

    this.waiting.delete(token);
    clearTimeout(waiting.timer);
    (socket as Socket).setNoDelay(true);
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: ${TUNNEL_PROTOCOL}\r\n\r\n`);
    if (head.length > 0) {
      waiting.socket.write(head);
    }
    splice(waiting.socket, socket);
    return true;
  }

  public close(): void {
    for (const listener of this.listeners.values()) {
      this.closeListener(listener);
    }
  }

  private async openListener(key: string, target: HostPort, open: OpenTunnel): Promise<Listener> {
    const server = createServer((socket) => this.connect(listener, socket));
    const listener: Listener = { key, server, port: 0, target, open, connections: new Set() };

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    server.on('error', () => this.closeListener(listener));

    listener.port = (server.address() as AddressInfo).port;
    return listener;
  }

  private connect(listener: Listener, socket: Socket): void {
    clearTimeout(listener.idleTimer);
    socket.pause();
    socket.setNoDelay(true);

    const token = randomBytes(18).toString('base64url');
    const close = (): void => {
      if (!listener.connections.delete(close)) return;
      const waiting = this.waiting.get(token);
      if (waiting?.socket === socket) {
        clearTimeout(waiting.timer);
        this.waiting.delete(token);
      }
      socket.destroy();
      this.armIdle(listener);
    };
    listener.connections.add(close);
    socket.on('error', close).on('close', close);

    this.waiting.set(token, { listener, socket, timer: setTimeout(close, DIAL_TIMEOUT_MS) });
    listener.open(listener.target, token).catch(() => {
      if (this.waiting.get(token)?.socket === socket) close();
    });
  }

  private armIdle(listener: Listener): void {
    clearTimeout(listener.idleTimer);
    if (listener.connections.size > 0 || this.listeners.get(listener.key) !== listener) {
      return;
    }
    listener.idleTimer = setTimeout(() => this.closeListener(listener), IDLE_CLOSE_MS);
    listener.idleTimer.unref();
  }

  private closeListener(listener: Listener): void {
    if (this.listeners.get(listener.key) === listener) {
      this.listeners.delete(listener.key);
    }
    clearTimeout(listener.idleTimer);
    listener.server.close();
    for (const close of Array.from(listener.connections)) {
      close();
    }
  }
}

export class StreamTunnelDialer {
  private open = new Set<() => void>();

  constructor(
    private master: () => string,
    private apiPort: () => number,
  ) {}

  public async dial(target: HostPort, token: string): Promise<void> {
    const plugin = createConnection({ host: target.host, port: target.port });
    plugin.on('error', () => plugin.destroy());
    plugin.setNoDelay(true);

    let master: TLSSocket;
    try {
      await once(plugin, 'connect');
      master = await upgrade(this.master(), this.apiPort(), token);
    } catch (error) {
      plugin.destroy();
      throw error;
    }
    if (plugin.destroyed) {
      master.destroy();
      throw new Error('the plugin closed the connection');
    }

    const close = splice(plugin, master, () => this.open.delete(close));
    this.open.add(close);
  }

  public close(): void {
    for (const close of Array.from(this.open)) {
      close();
    }
  }
}

export function loopbackTarget(url: string): HostPort | undefined {
  const match = URL_AUTHORITY.exec(url);
  if (!match) {
    return undefined;
  }
  const host = match[3].replace(/^\[|\]$/g, '').toLowerCase();
  if (host !== 'localhost' && host !== '::1' && !host.startsWith('127.')) {
    return undefined;
  }
  const port = match[4] ? Number(match[4]) : DEFAULT_PORTS[match[1].toLowerCase()];
  return port ? { host, port } : undefined;
}

export function withHostPort(url: string, to: HostPort): string {
  return url.replace(URL_AUTHORITY, (_match, scheme: string, auth: string | undefined) => `${scheme}${auth ?? ''}${hostPort(to)}`);
}

export function hostPort({ host, port }: HostPort): string {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}

function splice(a: Duplex, b: Duplex, onClose?: () => void): () => void {
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    a.destroy();
    b.destroy();
    onClose?.();
  };
  a.on('error', close).on('close', close);
  b.on('error', close).on('close', close);
  a.pipe(b).pipe(a);
  return close;
}

async function upgrade(host: string, port: number, token: string): Promise<TLSSocket> {
  const socket = connectTls({ host, port, rejectUnauthorized: false, ALPNProtocols: ['http/1.1'], servername: isIP(host) ? undefined : host });
  socket.setTimeout(DIAL_TIMEOUT_MS, () => socket.destroy(new Error(`master ${host}:${port} did not answer`)));
  try {
    await once(socket, 'secureConnect');
    socket.write(`GET ${TUNNEL_PATH}${token} HTTP/1.1\r\nHost: ${hostPort({ host, port })}\r\nConnection: Upgrade\r\nUpgrade: ${TUNNEL_PROTOCOL}\r\n\r\n`);
    const status = await readStatus(socket);
    if (status !== 101) {
      throw new Error(`master ${host}:${port} answered ${status}`);
    }
  } catch (error) {
    socket.destroy();
    throw error;
  }
  socket.setTimeout(0);
  socket.setNoDelay(true);
  return socket;
}

function readStatus(socket: TLSSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    let head = Buffer.alloc(0);
    const stop = (): void => {
      socket.off('data', onData).off('error', onError).off('close', onClose);
      // pause before the unshift, a flowing stream would emit the bytes straight away
      socket.pause();
    };
    const onData = (chunk: Buffer): void => {
      head = Buffer.concat([head, chunk]);
      const end = head.indexOf('\r\n\r\n');
      if (end >= 0) {
        stop();
        const rest = head.subarray(end + 4);
        if (rest.length > 0) socket.unshift(rest);
        const status = /^HTTP\/1\.[01] (\d{3})/.exec(head.subarray(0, end).toString('latin1'));
        resolve(status ? Number(status[1]) : 0);
      } else if (head.length > MAX_HEAD_BYTES) {
        stop();
        reject(new Error('master sent no valid answer'));
      }
    };
    const onError = (error: Error): void => {
      stop();
      reject(error);
    };
    const onClose = (): void => {
      stop();
      reject(new Error('master closed the connection'));
    };
    socket.on('data', onData).on('error', onError).on('close', onClose);
  });
}
