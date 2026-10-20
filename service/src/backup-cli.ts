import { createWriteStream } from 'node:fs';
import { open, readFile, rename, rm, stat } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pipeline } from 'node:stream/promises';
import { sleep } from '@camera.ui/common/utils';

import { Spinner } from './spinner.js';

import type { IncomingMessage } from 'node:http';

export type RestoreMode = 'move' | 'copy';

export interface Prompt {
  interactive: boolean;
  ask(question: string): Promise<string>;
  secret(question: string): Promise<string>;
}

export interface Credentials {
  token?: string;
  username?: string;
  password?: string;
  code?: string;
}

export interface BackupCommandOptions {
  output?: string;
}

export interface RestoreCommandOptions {
  mode?: RestoreMode;
  keyFile?: string;
  yes?: boolean;
}

interface CallOptions {
  body?: unknown;
  data?: Buffer;
  headers?: Record<string, string>;
  timeout?: number;
  sink?: string;
}

interface CallResult {
  status: number;
  body: any;
}

interface Session {
  access_token: string;
  refresh_token?: string;
}

interface BackupJob {
  id: string;
  state: 'running' | 'done' | 'failed';
  phase: 'snapshot' | 'packing';
  done: number;
  total: number;
  size?: number;
  error?: string;
  download?: { url: string; filename: string };
}

interface RestoreUpload {
  id: string;
  size: number;
  received: number;
  chunkSize: number;
}

interface RestorePlugin {
  name: string;
  version: string;
  installVersion?: string;
  state: string;
  note?: string;
  reason?: string;
  worker?: string;
  error?: string;
}

interface RestoreStatus {
  id: string;
  state: string;
  mode?: RestoreMode;
  error?: string;
  plugins?: RestorePlugin[];
  summary?: {
    version: string;
    platform: string;
    createdAt: number;
    cameras: number;
    accounts: { username: string }[];
    suggestedMode?: RestoreMode;
    sameServer?: boolean;
    workers?: number;
    sourceRunning?: string[];
    excluded?: { path: string; size: number }[];
    pluginsNotInBackup?: string[];
  };
}

const KEY_PATTERN = /([A-Z2-7]{4}-){7}[A-Z2-7]{4}/;
const JOB_POLL_MS = 1000;
const RESTORE_POLL_MS = 2000;
const RESTORE_WAIT_MS = 30 * 60_000;
const LONG_TIMEOUT_MS = 10 * 60_000;
const UPLOAD_RETRIES = 5;
const FINISHED_STATES = new Set(['done', 'done-with-problems', 'failed', 'rolled-back', 'cancelled', 'expired']);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export class CameraUiApi {
  public hasSession = false;

  private accessToken?: string;
  private refreshToken?: string;

  constructor(private readonly baseUrl: string) {}

  public async signIn(credentials: Credentials, prompt: Prompt, sessionNeeded: boolean): Promise<void> {
    if (credentials.token && !sessionNeeded) {
      this.accessToken = credentials.token;
      return;
    }

    const username = credentials.username ?? (await ask(prompt, 'Username: ', '--username'));
    const password = credentials.password ?? (await askSecret(prompt, 'Password: ', 'CAMERA_UI_PASSWORD'));
    let session = await this.json<Session & { requires2fa?: boolean; tempToken?: string }>('POST', '/api/auth/login', {
      body: { username, password, kind: 'web', persistent: false, device: { id: 'cameraui-cli', name: 'camera.ui CLI' } },
    });

    if (session.requires2fa) {
      const code = credentials.code ?? (await ask(prompt, 'Two-factor code: ', '--code'));
      session = await this.json<Session>('POST', '/api/auth/verify-2fa', { body: { tempToken: session.tempToken, code } });
    }

    this.accessToken = session.access_token;
    this.refreshToken = session.refresh_token;
    this.hasSession = true;
  }

  public async signOut(): Promise<void> {
    if (!this.hasSession) return;
    await this.call('POST', '/api/auth/logout', { timeout: 5000 }).catch(() => {});
    this.hasSession = false;
  }

  public async json<T>(method: string, path: string, options: CallOptions = {}): Promise<T> {
    let result = await this.call(method, path, options);

    if (result.status === 401 && this.refreshToken) {
      const refreshed = await this.call('POST', '/api/auth/refresh', { body: { refresh_token: this.refreshToken } });
      if (refreshed.status < 300) {
        this.accessToken = refreshed.body.access_token;
        this.refreshToken = refreshed.body.refresh_token ?? this.refreshToken;
        result = await this.call(method, path, options);
      }
    }

    if (result.status >= 300) {
      const message = result.body?.message ?? result.body?.error_description ?? `Request failed with status ${result.status}`;
      throw new ApiError(message, result.status, result.body?.code);
    }
    return result.body as T;
  }

  public async download(path: string, file: string): Promise<void> {
    const result = await this.call('GET', path, { sink: file, timeout: LONG_TIMEOUT_MS });
    if (result.status !== 200) throw new ApiError(result.body?.message ?? `Download failed with status ${result.status}`, result.status);
  }

  private call(method: string, path: string, options: CallOptions = {}): Promise<CallResult> {
    const url = new URL(path, this.baseUrl);
    const payload = options.data ?? (options.body === undefined ? undefined : Buffer.from(JSON.stringify(options.body)));
    const headers: Record<string, string> = { ...options.headers };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    if (payload) {
      headers['Content-Type'] ??= 'application/json';
      headers['Content-Length'] = String(payload.length);
    }

    const send = url.protocol === 'http:' ? httpRequest : httpsRequest;

    return new Promise<CallResult>((resolvePromise, reject) => {
      // the server answers on loopback with its own certificate
      const req = send(url, { method, headers, rejectUnauthorized: false, timeout: options.timeout ?? 60_000 }, (res) => {
        if (options.sink && res.statusCode === 200) {
          pipeline(res, createWriteStream(options.sink))
            .then(() => resolvePromise({ status: 200, body: undefined }))
            .catch(reject);
          return;
        }
        readBody(res).then(resolvePromise, reject);
      });

      req.on('timeout', () => req.destroy(new Error(`No answer from ${url.host} in time`)));
      req.on('error', reject);
      req.end(payload);
    });
  }
}

export function createPrompt(): Prompt {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  return {
    interactive,
    async ask(question) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return (await rl.question(question)).trim();
      } finally {
        rl.close();
      }
    },
    secret: readHidden,
  };
}

export async function backupCommand(api: CameraUiApi, options: BackupCommandOptions): Promise<string> {
  const spinner = new Spinner({ text: 'Copying the databases...' }).start();

  try {
    let job = await api.json<BackupJob>('POST', '/api/backup/jobs', { body: {} });

    while (job.state === 'running') {
      await sleep(JOB_POLL_MS);
      const current = await api.json<BackupJob>('GET', '/api/backup/jobs');
      if (current.id !== job.id) throw new Error('The backup stopped because the server restarted.');
      job = current;
      spinner.text = job.phase === 'packing' && job.total ? `Packing the backup... ${Math.round((job.done / job.total) * 100)}%` : 'Copying the databases...';
    }

    if (job.state === 'failed' || !job.download) throw new Error(job.error ?? 'The backup failed.');

    const target = await outputPath(options.output, job.download.filename);
    const partial = `${target}.part`;
    spinner.text = 'Downloading the backup...';

    try {
      await api.download(job.download.url, partial);
      await rename(partial, target);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }

    spinner.succeed(`Backup saved to ${target} (${formatBytes((await stat(target)).size)})`);
    return target;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

export async function remindBackupKey(api: CameraUiApi): Promise<string | undefined> {
  if (!api.hasSession) return undefined;
  const info = await api.json<{ confirmedAt?: number }>('GET', '/api/backup/key').catch(() => undefined);
  return info && !info.confirmedAt
    ? 'The backup is encrypted with the backup key of this server. Keep that key outside the server, it is shown under Settings, Backup.'
    : undefined;
}

export async function restoreCommand(api: CameraUiApi, file: string, options: RestoreCommandOptions, prompt: Prompt): Promise<boolean> {
  if (!options.yes && !prompt.interactive) throw new Error('No terminal to ask in, pass --yes.');

  const archive = resolve(file);
  const { size } = await stat(archive);
  const keyFromFile = options.keyFile ? await readKeyFile(options.keyFile) : undefined;

  const upload = await api.json<RestoreUpload>('POST', '/api/backup/restore/uploads', { body: { size, name: basename(archive) } });
  let started: { ticket: string; status: RestoreStatus };

  try {
    await sendArchive(api, archive, upload);
    started = await completeUpload(api, upload.id, keyFromFile, prompt);
  } catch (error) {
    await api.json('DELETE', `/api/backup/restore/uploads/${upload.id}`).catch(() => {});
    throw error;
  }

  const summary = started.status.summary;
  for (const line of describeSummary(started.status)) console.log(line);

  let confirmed = false;
  try {
    const mode = options.mode ?? (await chooseMode(prompt, summary?.suggestedMode ?? 'copy', options.yes));
    if (mode === 'move' && summary?.sourceRunning?.length) {
      console.log(`\nThe server of this backup still answers at ${summary.sourceRunning.join(', ')}. After a move it must not run anymore.`);
    }

    const answer = options.yes ? 'y' : await prompt.ask(`\nReplace the configuration of this server with this backup as ${mode}? [y/N] `);
    if (/^y(es)?$/i.test(answer)) {
      await api.json('POST', '/api/backup/restore/confirm', { body: { mode } });
      confirmed = true;
    }
  } finally {
    if (!confirmed) await api.json('DELETE', '/api/backup/restore').catch(() => {});
  }

  if (!confirmed) {
    console.log('Restore cancelled, nothing changed.');
    return false;
  }

  const status = await waitForRestore(api, started.ticket);
  return reportRestore(status);
}

function describeSummary(status: RestoreStatus): string[] {
  const summary = status.summary;
  if (!summary) return [];

  const lines = [
    '',
    `Backup of camera.ui ${summary.version} on ${summary.platform}, created ${new Date(summary.createdAt).toLocaleString()}`,
    `Cameras: ${summary.cameras}, accounts: ${summary.accounts.map((account) => account.username).join(', ') || 'none'}`,
  ];
  if (summary.workers) lines.push(`Workers: ${summary.workers}`);
  if (summary.sameServer) lines.push('This backup comes from this server.');

  for (const plugin of status.plugins ?? []) {
    const version = plugin.installVersion && plugin.installVersion !== plugin.version ? `${plugin.version}, installs ${plugin.installVersion}` : plugin.version;
    const note = plugin.note === 'unavailable' ? ', not available' : plugin.note === 'platform' ? ', runs only on a matching worker' : '';
    lines.push(`Plugin ${plugin.name} (${version}${note})${plugin.worker ? ` on worker ${plugin.worker}` : ''}${plugin.reason ? `: ${plugin.reason}` : ''}`);
  }
  for (const name of summary.pluginsNotInBackup ?? []) lines.push(`Plugin ${name} is not in the backup, it stays installed but starts without its settings`);

  for (const folder of summary.excluded ?? []) lines.push(`Not in the backup: ${folder.path} (${formatBytes(folder.size)})`);
  return lines;
}

async function chooseMode(prompt: Prompt, suggested: RestoreMode, yes?: boolean): Promise<RestoreMode> {
  if (yes || !prompt.interactive) return suggested;

  console.log('\nmove: this server takes over from the old one, which must not run anymore.');
  console.log('copy: both keep running, this server gets its own identity.');
  const answer = (await prompt.ask(`Restore as move or copy? [${suggested}] `)).toLowerCase();
  if (!answer) return suggested;
  if (answer !== 'move' && answer !== 'copy') throw new Error(`Unknown mode "${answer}", use move or copy.`);
  return answer;
}

async function sendArchive(api: CameraUiApi, archive: string, upload: RestoreUpload): Promise<void> {
  const handle = await open(archive, 'r');
  const spinner = new Spinner({ text: 'Uploading the backup...' }).start();
  let received = upload.received;
  let failures = 0;

  try {
    while (received < upload.size) {
      const offset = received;
      const length = Math.min(upload.chunkSize, upload.size - offset);
      const chunk = Buffer.alloc(length);
      await handle.read(chunk, 0, length, offset);

      try {
        received = (
          await api.json<RestoreUpload>('PATCH', `/api/backup/restore/uploads/${upload.id}`, {
            data: chunk,
            headers: { 'Content-Type': 'application/octet-stream', 'Upload-Offset': String(offset) },
            timeout: LONG_TIMEOUT_MS,
          })
        ).received;
        failures = 0;
      } catch (error) {
        const retryable = !(error instanceof ApiError) || error.status === 409 || error.status >= 500;
        if (!retryable || ++failures > UPLOAD_RETRIES) throw error;
        await sleep(failures * 1000);
        received = await api
          .json<RestoreUpload>('GET', `/api/backup/restore/uploads/${upload.id}`)
          .then((current) => current.received)
          .catch(() => offset);
      }

      spinner.text = `Uploading the backup... ${Math.round((received / upload.size) * 100)}%`;
    }
    spinner.succeed('Backup uploaded');
  } catch (error) {
    spinner.stop();
    throw error;
  } finally {
    await handle.close();
  }
}

async function completeUpload(api: CameraUiApi, id: string, keyFromFile: string | undefined, prompt: Prompt): Promise<{ ticket: string; status: RestoreStatus }> {
  let key = keyFromFile;

  for (;;) {
    const spinner = new Spinner({ text: 'Checking the backup...' }).start();
    try {
      const started = await api.json<{ ticket: string; status: RestoreStatus }>('POST', `/api/backup/restore/uploads/${id}/complete`, {
        body: key ? { key } : undefined,
        timeout: LONG_TIMEOUT_MS,
      });
      spinner.succeed('Backup checked');
      return started;
    } catch (error) {
      const keyProblem = error instanceof ApiError && error.status === 422 && (error.code === 'backup-key-required' || error.code === 'backup-key-wrong');
      if (!keyProblem || keyFromFile || !prompt.interactive) {
        spinner.stop();
        throw keyProblem && !keyFromFile ? new Error('This backup is encrypted, pass the backup key of the server it comes from with --key-file.') : error;
      }

      spinner.warn(error.code === 'backup-key-wrong' ? 'This key does not open the backup.' : 'This backup is encrypted with the key of another server.');
      const answer = await prompt.ask('Backup key (empty to stop): ');
      if (!answer) throw new Error('No backup key given.');
      key = parseKey(answer) ?? answer;
    }
  }
}

async function waitForRestore(api: CameraUiApi, ticket: string): Promise<RestoreStatus | null> {
  const spinner = new Spinner({ text: 'Restoring, the server restarts...' }).start();
  const deadline = Date.now() + RESTORE_WAIT_MS;
  let last: RestoreStatus | null = null;

  while (Date.now() < deadline) {
    await sleep(RESTORE_POLL_MS);
    try {
      last = await api.json<RestoreStatus>('GET', '/api/backup/restore/status', { headers: { 'X-Restore-Ticket': ticket }, timeout: 5000 });
      if (FINISHED_STATES.has(last.state)) {
        spinner.stop();
        return last;
      }
    } catch {
      // the server is restarting
    }
  }

  spinner.fail('The server did not finish the restore in time, check the logs.');
  return last;
}

function reportRestore(status: RestoreStatus | null): boolean {
  if (!status) return false;

  for (const plugin of status.plugins ?? []) {
    if (plugin.state === 'failed') console.log(`Plugin ${plugin.name} was not installed: ${plugin.error ?? 'unknown error'}`);
  }

  switch (status.state) {
    case 'done':
      console.log('Restore finished.');
      return true;
    case 'done-with-problems':
      console.log('Restore finished with problems, see the plugins above and Settings, Backup.');
      return true;
    case 'rolled-back':
      console.log(`The restored server did not start, the previous state is back: ${status.error ?? ''}`.trim());
      return false;
    default:
      console.log(`Restore ${status.state}: ${status.error ?? ''}`.trim());
      return false;
  }
}

async function outputPath(output: string | undefined, filename: string): Promise<string> {
  if (!output) return resolve(filename);
  const target = resolve(output);
  const isDirectory = await stat(target)
    .then((info) => info.isDirectory())
    .catch(() => false);
  return isDirectory ? join(target, filename) : target;
}

async function readKeyFile(path: string): Promise<string> {
  const key = parseKey(await readFile(path, 'utf8'));
  if (!key) throw new Error(`No backup key found in ${path}.`);
  return key;
}

function parseKey(text: string): string | undefined {
  return KEY_PATTERN.exec(text.toUpperCase())?.[0];
}

async function ask(prompt: Prompt, question: string, flag: string): Promise<string> {
  if (!prompt.interactive) throw new Error(`No terminal to ask in, pass ${flag}.`);
  return prompt.ask(question);
}

async function askSecret(prompt: Prompt, question: string, env: string): Promise<string> {
  if (!prompt.interactive) throw new Error(`No terminal to ask in, set ${env}.`);
  return prompt.secret(question);
}

function readHidden(question: string): Promise<string> {
  const stdin = process.stdin;

  return new Promise((resolvePromise) => {
    let value = '';
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (input: string): void => {
      for (const char of input) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          finish();
          resolvePromise(value);
          return;
        }
        if (char === '\u0003') {
          finish();
          process.exit(130);
        }
        value = char === '\u007f' || char === '\b' ? value.slice(0, -1) : value + char;
      }
    };

    function finish(): void {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
    }

    stdin.on('data', onData);
  });
}

async function readBody(res: IncomingMessage): Promise<CallResult> {
  const chunks: Buffer[] = [];
  for await (const chunk of res) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');

  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // plain text answer
  }
  return { status: res.statusCode ?? 0, body };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(1)} ${units[unit]}`;
}
