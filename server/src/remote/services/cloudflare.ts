import { API_EVENT } from '@camera.ui/sdk';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { container } from 'tsyringe';

import { RemoteService } from '../../api/services/remote.service.js';
import { isShuttingDown } from '../../shutdown-state.js';
import { CloudflareManagedService } from './cloudflare-managed.js';
import { cloudflaredBinaryPath, edgeProtocol, isCloudflaredInstalled, removeDownloadedCloudflared } from './cloudflaredBinary.js';
import { RestartBackoff } from './restartBackoff.js';
import { TunnelConnections } from './tunnelConnections.js';

import type { Logger } from '@camera.ui/common';
import type { ChildProcess } from 'node:child_process';
import type { Interface } from 'node:readline';
import { stripVTControlCharacters } from 'node:util';
import type { CameraUiAPI } from '../../api.js';
import type { DBCloudflareMode } from '../../api/database/types.js';
import type { ConfigService } from '../../services/config/index.js';

const INVALID_TOKEN = /token is not valid/i;

export class CloudflareService {
  public readonly managed: CloudflareManagedService;
  public readonly connections = new TunnelConnections();

  private api: CameraUiAPI;
  private configService: ConfigService;
  private remoteService: RemoteService;

  private cloudflareUrl: string | null = null;
  private cloudflarePath: string;
  private cloudflaredProcess?: ChildProcess;
  private currentArgs: string[] = [];
  private launch: 'configured' | 'quick' = 'configured';
  private backoff = new RestartBackoff();
  private fatalError: string | null = null;

  private shuttingDown = false;
  private manuallyKilled = false;

  private reconnectTimer?: NodeJS.Timeout;

  private stdoutLine?: Interface;
  private stderrLine?: Interface;

  constructor(
    private logger: Logger,
    private onUrlDetected?: (url: string) => void,
  ) {
    this.api = container.resolve<CameraUiAPI>('api');
    this.configService = container.resolve<ConfigService>('configService');
    this.remoteService = new RemoteService();
    this.managed = new CloudflareManagedService(logger);

    const configDir = this.configService.STORAGE_PATH;
    this.cloudflarePath = join(configDir, '.cloudflare');
    mkdirSync(this.cloudflarePath, { recursive: true });

    this.api.setMaxListeners(this.api.getMaxListeners() + 1);
    this.api.once(API_EVENT.SHUTDOWN, () => {
      this.shuttingDown = true;
      this.stop();
    });
  }

  public get url(): string | null {
    return this.cloudflareUrl ?? this.managed.runningUrl;
  }

  public get isRunning(): boolean {
    return !!this.cloudflaredProcess || this.reconnectTimer !== undefined || this.managed.runningUrl !== null || this.managed.busy;
  }

  public get lastError(): string | null {
    return this.fatalError;
  }

  public async start(): Promise<void> {
    this.launch = 'configured';
    this.backoff.reset();
    await this.run();
  }

  public async startQuick(): Promise<void> {
    this.launch = 'quick';
    this.backoff.reset();
    await this.run();
  }

  public stop(): void {
    this.manuallyKilled = true;
    this.fatalError = null;
    this.managed.stop();
    this.reset();
  }

  public stopOwnTunnel(): void {
    if (!this.cloudflaredProcess && !this.reconnectTimer) return;
    this.manuallyKilled = true;
    this.reset();
    this.manuallyKilled = false;
    this.launch = 'configured';
  }

  private async run(): Promise<void> {
    this.fatalError = null;
    try {
      await this.ensureCloudflaredInstalled();

      if (this.launch === 'quick') {
        this.stop();
        this.manuallyKilled = false;
        this.startQuickTunnel();
        return;
      }

      const config = this.remoteService.info().cloudflare;
      const mode: DBCloudflareMode = config?.mode ?? 'quick';

      if (mode === 'managed' && this.managed.busy) {
        return;
      }

      this.stop();
      this.manuallyKilled = false;

      switch (mode) {
        case 'quick':
          this.startQuickTunnel();
          return;
        case 'token':
          if (!config?.token || !config?.hostname) {
            this.logger.warn('Cloudflare: Token mode requires both token and hostname — falling back to Quick Tunnel.');
            this.startQuickTunnel();
            return;
          }
          this.startTokenTunnel(config.token, config.hostname);
          return;
        case 'managed':
          this.cloudflareUrl = config?.hostname ? `https://${config.hostname}` : null;
          if (this.cloudflareUrl) this.onUrlDetected?.(this.cloudflareUrl);
          await this.managed.resumeIfReady();
          return;
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private async ensureCloudflaredInstalled(): Promise<void> {
    if (!this.isCloudflaredInstalled()) {
      this.fatalError = `No cloudflared binary for ${process.platform}-${process.arch}`;
      throw new Error(this.fatalError);
    }

    await removeDownloadedCloudflared(this.cloudflarePath);
  }

  private reset(): void {
    this.stdoutLine?.close();
    this.stdoutLine = undefined;

    this.stderrLine?.close();
    this.stderrLine = undefined;

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;

    this.cloudflaredProcess?.kill('SIGKILL');
    this.cloudflaredProcess = undefined;

    this.connections.reset();

    this.cloudflareUrl = null;
    this.currentArgs = [];
  }

  private startQuickTunnel(): void {
    const url = `https://127.0.0.1:${this.configService.config.port}`;
    const config = this.writeConfig('quick', [`url: ${url}`, 'no-tls-verify: true', 'no-autoupdate: true']);
    this.spawnCloudflared(['tunnel', ...this.protocolArgs(), '--config', config, '--url', url, '--no-autoupdate', '--no-tls-verify']);
  }

  private startTokenTunnel(token: string, hostname: string): void {
    this.cloudflareUrl = `https://${hostname}`;
    this.onUrlDetected?.(this.cloudflareUrl);
    const config = this.writeConfig('token', ['no-autoupdate: true']);
    this.spawnCloudflared(['tunnel', ...this.protocolArgs(), '--no-autoupdate', '--config', config, 'run'], { TUNNEL_TOKEN: token });
  }

  private protocolArgs(): string[] {
    return ['--protocol', edgeProtocol(this.configService.CLOUDFLARED_PROTOCOL, this.logger)];
  }

  private writeConfig(name: string, lines: string[]): string {
    // without --config cloudflared loads ~/.cloudflared/config.yml, whose ingress would replace ours
    const path = join(this.cloudflarePath, `${name}.yml`);
    writeFileSync(path, [...lines, ''].join('\n'), { mode: 0o600 });
    return path;
  }

  private spawnCloudflared(args: string[], env: NodeJS.ProcessEnv = {}): void {
    this.currentArgs = args;
    const binPath = this.cloudflaredBinaryPath();

    this.cloudflaredProcess = spawn(binPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      windowsHide: true,
    });

    this.setupProcessHandlers();
  }

  private setupProcessHandlers(): void {
    if (!this.cloudflaredProcess) return;

    const proc = this.cloudflaredProcess;
    const cloudflaredPID = proc.pid;

    if (cloudflaredPID) {
      this.configService.addProcess({
        pid: cloudflaredPID,
        startTime: Date.now(),
        command: this.cloudflaredBinaryPath(),
        args: this.currentArgs,
      });
    }

    proc.on('error', (error) => {
      if (cloudflaredPID) {
        this.configService.removeProcessByPID(cloudflaredPID);
      }

      if (this.cloudflaredProcess !== proc || isShuttingDown()) return;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'EACCES') {
        this.fatalError = `cloudflared could not be started: ${error.message}`;
      }
      this.handleError(error);
    });

    proc.on('exit', (code) => {
      if (cloudflaredPID) {
        this.configService.removeProcessByPID(cloudflaredPID);
      }

      if (this.cloudflaredProcess !== proc || isShuttingDown()) return;

      this.handleError(new Error(`Process exited unexpectedly with code ${code}`));
    });

    this.stdoutLine = createInterface({
      input: this.cloudflaredProcess.stdout!,
      terminal: false,
    });

    this.stderrLine = createInterface({
      input: this.cloudflaredProcess.stderr!,
      terminal: false,
    });

    this.stdoutLine.on('line', this.processLogger.bind(this));
    this.stderrLine.on('line', this.processLogger.bind(this));
  }

  private handleError(error: any): void {
    if (this.shuttingDown) {
      return;
    }

    this.connections.exited();

    if (this.fatalError) {
      this.reset();
      this.logger.error(`Cloudflare: ${this.fatalError} Not restarting until the remote settings change.`);
      return;
    }

    if (this.manuallyKilled) {
      return;
    }

    this.logger.error('Cloudflare:', error?.message ?? error);
    this.reset();

    const delay = this.backoff.nextDelay();
    if (delay > 0) {
      this.logger.log(`Restarting cloudflared in ${Math.round(delay / 1000)}s`);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.shuttingDown || this.manuallyKilled) {
        return;
      }

      this.run();
    }, delay);
  }

  private processLogger(line: string): void {
    const blankLine = stripVTControlCharacters(line.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?\s*/, ''));

    this.analyzeLogLine(blankLine);

    if (blankLine.includes('WRN') && !this.shuttingDown && !this.manuallyKilled) {
      this.logger.warn(blankLine);
    } else if (
      (blankLine.includes('FTL') || blankLine.includes('ERR') || (!blankLine.includes('DBG') && blankLine.toLowerCase().includes('error'))) &&
      !this.shuttingDown &&
      !this.manuallyKilled
    ) {
      this.logger.error(blankLine);
    } else if (!blankLine.includes('exit with signal')) {
      this.logger.trace(blankLine);
    }
  }

  private analyzeLogLine(line: string): void {
    this.connections.observe(line);
    if (this.connections.registered) {
      this.backoff.registered();
    }

    if (INVALID_TOKEN.test(line)) {
      this.fatalError = 'Cloudflare does not accept the tunnel token.';
    }

    const match = /(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/.exec(line);
    if (match && !this.cloudflareUrl) {
      this.logger.log('Cloudflare URL detected:', match[1]);
      this.cloudflareUrl = match[1];
      this.onUrlDetected?.(match[1]);
    }
  }

  private cloudflaredBinaryPath(): string {
    return cloudflaredBinaryPath();
  }

  private isCloudflaredInstalled(): boolean {
    return isCloudflaredInstalled();
  }
}
