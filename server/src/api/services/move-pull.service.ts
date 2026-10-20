import { ensureDir, remove } from 'fs-extra/esm';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { request } from 'node:https';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { setTimeout as wait } from 'node:timers/promises';

import { inject } from '../../container.js';
import { ConfigService } from '../../services/config/index.js';
import { decodeMoveCode, moveSecretMatches, readMoveRecord } from '../../services/config/move.js';
import { assertRestorableVersion, readRestoreJournal, RestoreError, updateRestoreJournal } from '../../services/config/restore.js';
import { connectPinned, PinMismatchError } from '../utils/pinned-tls.js';
import { BackupService } from './backup.service.js';

import type { IncomingMessage } from 'node:http';
import type { MoveCode } from '../../services/config/move.js';
import type { LoggerService } from '../../services/logger/index.js';
import type { MovePeer, MovePeerStatus, MovePullState, MovePullStatus } from '../types/index.js';

interface Pull {
  status: MovePullStatus;
  abort: AbortController;
  peer?: MovePeer;
  received?: boolean;
}

const CONNECT_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 15_000;
const PACK_TIMEOUT_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 2_000;
const IDLE_TIMEOUT_MS = 60_000;
const DOWNLOAD_ATTEMPTS = 3;
const MAX_ANSWER_BYTES = 64 * 1024;
const FINISHED_STATES = new Set<MovePullState>(['staged', 'failed', 'cancelled']);

class PeerError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export class MovePullService {
  private static current: Pull | null = null;

  private logger: LoggerService;
  private configService: ConfigService;

  constructor() {
    this.logger = inject('logger');
    this.configService = inject('configService');
  }

  public start(code: string, address?: string): MovePullStatus {
    if (MovePullService.current && !FINISHED_STATES.has(MovePullService.current.status.state)) {
      throw new RestoreError('A move from another server is running already.', 409);
    }

    const move = decodeMoveCode(code);
    if (!move) {
      throw new RestoreError('This is not a move code. Copy it again from the old server.');
    }
    const own = readMoveRecord(this.configService.MOVE_FILE);
    if (own && moveSecretMatches(own, move.secret)) {
      throw new RestoreError('This move code belongs to this server. Enter it on the server that takes over.', 409);
    }

    const pull: Pull = { status: { state: 'connecting', received: 0, updatedAt: Date.now() }, abort: new AbortController() };
    MovePullService.current = pull;
    this.run(pull, move, address ? [address] : move.hosts);
    return pull.status;
  }

  public status(): MovePullStatus | null {
    return MovePullService.current?.status ?? null;
  }

  public async cancel(): Promise<void> {
    const journal = readRestoreJournal(this.configService.RESTORE_JOURNAL_FILE);
    const staged = MovePullService.current?.status.state === 'staged' || (journal?.kind === 'move' && journal.state === 'ready');
    // throws once confirmed, the old server then stays stopped
    if (staged) await new BackupService().cancelRestore();
    await this.release();
  }

  public async release(): Promise<void> {
    const pull = MovePullService.current;
    MovePullService.current = null;
    pull?.abort.abort();

    const stored = this.discardedPeer();
    const peer = pull?.peer ?? stored;
    if (peer) {
      await this.peerJson(peer, 'abandon').catch((error) => this.logger.warn(`The old server could not be told to run again: ${error.message}`));
    }
  }

  private async run(pull: Pull, move: MoveCode, hosts: string[]): Promise<void> {
    try {
      const found = await this.findPeer(move, hosts);
      pull.peer = found.peer;
      this.update(pull, { source: `${found.peer.host}:${found.peer.port}` });
      assertRestorableVersion(found.status.version, ConfigService.VERSION);

      let state = found.status;
      if (state.state === 'offered') {
        this.update(pull, { state: 'stopping' });
        state = await this.peerJson<MovePeerStatus>(found.peer, 'prepare');
      }
      state = await this.waitUntilPacked(pull, found.peer, state);

      const file = await this.download(pull, found.peer, state.size ?? 0);
      try {
        await this.confirmReceived(pull, found.peer);
        this.update(pull, { state: 'checking' });
        pull.status.started = await new BackupService().stageMove(file, found.peer);
      } finally {
        await remove(file).catch(() => {});
      }

      this.update(pull, { state: 'staged' });
      this.logger.log(`The backup of ${pull.status.source} arrived and waits to be confirmed`);
    } catch (error) {
      if (pull.abort.signal.aborted) return;
      this.update(pull, { state: 'failed', error: error.message });
      this.logger.warn(`Moving from another server failed: ${error.message}`);
      if (pull.received && pull.peer) {
        await this.peerJson(pull.peer, 'abandon').catch((abandonError) => this.logger.warn(`The old server could not be told to run again: ${abandonError.message}`));
      }
    }
  }

  private async confirmReceived(pull: Pull, peer: MovePeer): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.peerJson(peer, 'received');
        pull.received = true;
        return;
      } catch (error) {
        const refused = error instanceof PeerError && !!error.status;
        if (pull.abort.signal.aborted || refused || attempt >= DOWNLOAD_ATTEMPTS) {
          throw new RestoreError(`The backup arrived, but the old server could not be told: ${error.message}`, 409);
        }
        await wait(POLL_INTERVAL_MS * attempt, undefined, { signal: pull.abort.signal });
      }
    }
  }

  private discardedPeer(): MovePeer | undefined {
    const file = this.configService.RESTORE_JOURNAL_FILE;
    const journal = readRestoreJournal(file);
    if (journal?.kind !== 'move' || journal.state !== 'cancelled' || !journal.movePeer) return undefined;

    updateRestoreJournal(file, (current) => delete current.movePeer);
    return journal.movePeer;
  }

  private async findPeer(move: MoveCode, hosts: string[]): Promise<{ peer: MovePeer; status: MovePeerStatus }> {
    const fallbackPort = parseHost(move.hosts[0], 443)?.port ?? 443;
    const candidates = hosts.map((host) => parseHost(host, fallbackPort)).filter((candidate) => !!candidate);
    if (!candidates.length) {
      throw new RestoreError('The address of the old server is not valid.');
    }

    try {
      return await Promise.any(
        candidates.map(async ({ host, port }) => {
          const peer: MovePeer = { host, port, fingerprint: move.fingerprint, secret: move.secret };
          return { peer, status: await this.peerJson<MovePeerStatus>(peer, 'check') };
        }),
      );
    } catch (error) {
      const errors: unknown[] = error instanceof AggregateError ? error.errors : [error];
      const answered = errors.find((entry) => entry instanceof PeerError && entry.status);
      if (answered instanceof PeerError) throw new RestoreError(answered.message, 409);

      const where = candidates.map(({ host, port }) => `${host}:${port}`).join(', ');
      if (errors.some((entry) => entry instanceof PinMismatchError)) {
        throw new RestoreError(`No server at ${where} is the one that created this code.`);
      }
      throw new RestoreError(`The old server could not be reached at ${where}. Enter its address.`);
    }
  }

  private async waitUntilPacked(pull: Pull, peer: MovePeer, initial: MovePeerStatus): Promise<MovePeerStatus> {
    const deadline = Date.now() + PACK_TIMEOUT_MS;
    let state = initial;

    while (state.state !== 'ready') {
      if (state.state === 'sent') throw new RestoreError('The old server has moved already. Create a new move code there.', 409);
      if (state.state === 'failed') throw new RestoreError(state.error ?? 'The old server could not pack its backup.', 409);
      if (Date.now() > deadline) throw new RestoreError('The old server did not get its backup ready in time. Check it and try again.', 409);

      this.update(pull, { state: state.state === 'packing' ? 'packing' : 'stopping' });
      await wait(POLL_INTERVAL_MS, undefined, { signal: pull.abort.signal });

      const previous = state;
      // the old server restarts in between and may not answer
      state = await this.peerJson<MovePeerStatus>(peer, 'check').catch((error) => {
        if (error instanceof PeerError && error.status) throw error;
        return previous;
      });
    }
    return state;
  }

  private async download(pull: Pull, peer: MovePeer, size: number): Promise<string> {
    await ensureDir(this.configService.RESTORE_UPLOADS_PATH);
    const file = join(this.configService.RESTORE_UPLOADS_PATH, `move-${randomBytes(8).toString('hex')}.part`);

    for (let attempt = 1; ; attempt++) {
      this.update(pull, { state: 'receiving', size, received: 0 });
      try {
        const res = await this.peerRequest(peer, 'archive', IDLE_TIMEOUT_MS, pull.abort.signal);
        if (res.statusCode !== 200) throw await peerErrorOf(res);

        res.on('data', (chunk: Buffer) => (pull.status.received += chunk.length));
        await pipeline(res, createWriteStream(file));
        if (pull.status.received !== size) throw new Error(`${pull.status.received} of ${size} bytes arrived`);
        return file;
      } catch (error) {
        await remove(file).catch(() => {});
        const refused = error instanceof PeerError && error.status !== 409;
        if (pull.abort.signal.aborted || refused || attempt >= DOWNLOAD_ATTEMPTS) {
          throw new RestoreError(`The transfer from the old server broke off: ${error.message}`, 409);
        }
        await wait(POLL_INTERVAL_MS * attempt, undefined, { signal: pull.abort.signal });
      }
    }
  }

  private async peerJson<T>(peer: MovePeer, step: string): Promise<T> {
    const res = await this.peerRequest(peer, step, REQUEST_TIMEOUT_MS);
    if (res.statusCode !== 200) throw await peerErrorOf(res);

    const body = await readAnswer(res);
    return (body ? JSON.parse(body) : undefined) as T;
  }

  private async peerRequest(peer: MovePeer, step: string, timeoutMs: number, signal?: AbortSignal): Promise<IncomingMessage> {
    const socket = await connectPinned(peer.host, peer.port, peer.fingerprint, CONNECT_TIMEOUT_MS);
    const payload = JSON.stringify({ secret: peer.secret });

    return new Promise((resolve, reject) => {
      const req = request(
        {
          host: peer.host,
          port: peer.port,
          path: `/api/backup/move/peer/${step}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          createConnection: () => socket,
          timeout: timeoutMs,
          signal,
        },
        resolve,
      );
      req.once('timeout', () => req.destroy(new Error(`${peer.host}:${peer.port} did not answer`)));
      req.once('error', reject);
      req.end(payload);
    });
  }

  private update(pull: Pull, change: Partial<MovePullStatus>): void {
    Object.assign(pull.status, change, { updatedAt: Date.now() });
  }
}

function parseHost(entry: string | undefined, fallbackPort: number): { host: string; port: number } | null {
  if (!entry) return null;
  try {
    const url = new URL(entry.includes('://') ? entry : `https://${entry}`);
    return { host: url.hostname.replace(/^\[(.*)\]$/, '$1'), port: url.port ? Number(url.port) : fallbackPort };
  } catch {
    return null;
  }
}

async function readAnswer(res: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of res) {
    body += chunk;
    if (body.length > MAX_ANSWER_BYTES) {
      res.destroy();
      throw new PeerError('The old server sent an answer that is too long');
    }
  }
  return body;
}

async function peerErrorOf(res: IncomingMessage): Promise<PeerError> {
  const body = await readAnswer(res).catch(() => '');
  let message = `The old server answered with status ${res.statusCode}`;
  try {
    message = JSON.parse(body).message ?? message;
  } catch {
    // keep the status
  }
  // fastify's 404 for a route an older camera.ui does not have
  if (res.statusCode === 404 && message.startsWith('Route ')) {
    message = 'The old server runs a camera.ui version that cannot move yet. Update it to 2.4.0 or newer.';
  }
  return new PeerError(message, res.statusCode);
}
