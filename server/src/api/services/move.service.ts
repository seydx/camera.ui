import { fetchViableNetworkAddresses } from '@camera.ui/common/network';
import { pathExists, remove } from 'fs-extra/esm';
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { isIPv4 } from 'node:net';

import { inject } from '../../container.js';
import { ConfigService } from '../../services/config/index.js';
import {
  certificateFingerprint,
  encodeMoveCode,
  hashMoveSecret,
  isMovedAway,
  MOVE_OFFER_TTL_MS,
  MOVE_READY_TTL_MS,
  moveSecretMatches,
  moveStatus,
  newMoveSecret,
  readMoveRecord,
  removeMoveRecord,
  settleMoveRecord,
  writeMoveRecord,
} from '../../services/config/move.js';
import { RestoreError } from '../../services/config/restore.js';
import { BackupService } from './backup.service.js';

import type { MoveRecord } from '../../services/config/move.js';
import type { LoggerService } from '../../services/logger/index.js';
import type { MoveOffer, MovePeerStatus, MoveStatus } from '../types/index.js';

export interface MoveArchive {
  path: string;
  size: number;
  progress(transferred: number): void;
  done(complete: boolean): void;
}

const SENDING_GRACE_MS = 60_000;

export class MoveService {
  private static transferred?: number;
  private static readyTimer?: NodeJS.Timeout;
  private static sentDirectory?: string;

  private logger: LoggerService;
  private configService: ConfigService;

  constructor() {
    this.logger = inject('logger');
    this.configService = inject('configService');
  }

  public createOffer(requestedHosts: string[]): MoveOffer {
    const current = this.read();
    if (isMovedAway(current)) {
      throw new RestoreError('This server is moving already. Let it run here again first.', 409);
    }
    removeMoveRecord(this.configService.MOVE_FILE, current);

    const secret = newMoveSecret();
    const now = Date.now();
    const record: MoveRecord = { state: 'offered', createdAt: now, expiresAt: now + MOVE_OFFER_TTL_MS, secretHash: hashMoveSecret(secret) };
    writeMoveRecord(this.configService.MOVE_FILE, record);

    const port = this.configService.config.port;
    const lan = fetchViableNetworkAddresses()
      .map((viable) => viable.address)
      .filter((address) => isIPv4(address))
      .map((address) => `${address}:${port}`);
    const code = encodeMoveCode({ hosts: [...new Set([...requestedHosts, ...lan])], secret, fingerprint: this.servedFingerprint() });

    this.logger.log('A move code for this server was created');
    return { code, status: moveStatus(record) };
  }

  public status(): MoveStatus | null {
    const record = this.read();
    return record ? { ...moveStatus(record), transferred: MoveService.transferred } : null;
  }

  public cancel(): boolean {
    const record = readMoveRecord(this.configService.MOVE_FILE);
    if (!record) return false;

    clearTimeout(MoveService.readyTimer);
    removeMoveRecord(this.configService.MOVE_FILE, record);

    const restart = isMovedAway(record);
    this.logger.log(restart ? 'The move is stopped, camera.ui runs on this server again' : 'The move code was withdrawn');
    return restart;
  }

  public peerStatus(secret: string): MovePeerStatus {
    return this.peerView(this.authorize(secret));
  }

  public prepare(secret: string, target: string): { status: MovePeerStatus; restart: boolean } {
    const record = this.authorize(secret);
    if (record.state === 'sent') throw new RestoreError('This server has moved already.', 409);
    if (record.state === 'failed') throw new RestoreError(record.error ?? 'The move failed on this server.', 409);

    const restart = record.state === 'offered';
    if (restart) {
      record.state = 'preparing';
      record.target = target;
      writeMoveRecord(this.configService.MOVE_FILE, record);
      this.logger.warn(`The server at ${target} takes over, camera.ui stops its cameras and plugins here and packs the backup`);
    }
    return { status: this.peerView(record), restart };
  }

  public openArchive(secret: string): MoveArchive {
    const record = this.authorize(secret);
    if (record.state === 'sent') throw new RestoreError('This server has moved already.', 409);
    if (record.state !== 'ready' || !record.archive || !record.size) throw new RestoreError('The backup is not packed yet.', 409);
    if (MoveService.transferred !== undefined) throw new RestoreError('The backup is being sent already.', 409);

    MoveService.transferred = 0;
    record.readyUntil = Math.max(record.readyUntil ?? 0, Date.now() + MOVE_READY_TTL_MS);
    writeMoveRecord(this.configService.MOVE_FILE, record);

    return {
      path: record.archive,
      size: record.size,
      progress: (transferred) => (MoveService.transferred = transferred),
      done: (complete) => this.finishSending(complete),
    };
  }

  public confirmReceived(secret: string): MovePeerStatus {
    const record = this.authorize(secret);
    if (record.state === 'sent') return this.peerView(record);
    if (record.state !== 'ready') throw new RestoreError('The backup is not packed yet.', 409);

    clearTimeout(MoveService.readyTimer);
    if (MoveService.transferred === undefined) {
      if (record.archiveDirectory) remove(record.archiveDirectory).catch(() => {});
    } else {
      MoveService.sentDirectory = record.archiveDirectory;
    }

    const { archive, archiveDirectory, ...rest } = record;
    const sent: MoveRecord = { ...rest, state: 'sent', sentAt: Date.now() };
    writeMoveRecord(this.configService.MOVE_FILE, sent);
    this.logger.log(`The backup arrived at ${record.target ?? 'the new server'}, this server has moved`);
    return this.peerView(sent);
  }

  public abandon(secret: string): boolean {
    this.authorize(secret);
    this.logger.warn('The new server does not take over');
    return this.cancel();
  }

  public async continueMovedAway(restart: () => void): Promise<void> {
    const record = this.read();
    if (!record || record.state === 'sent') return;

    if (record.state === 'ready' && record.archive && (await pathExists(record.archive))) {
      this.armReadyTimer(record, restart);
      return;
    }
    await this.pack(record, restart);
  }

  private async pack(record: MoveRecord, restart: () => void): Promise<void> {
    if (record.archiveDirectory) await remove(record.archiveDirectory).catch(() => {});
    Object.assign(record, { state: 'packing', archive: undefined, archiveDirectory: undefined, size: undefined });
    writeMoveRecord(this.configService.MOVE_FILE, record);

    try {
      const scheduler = inject('backupScheduler');
      // unencrypted with the key inside, it only travels over the pinned connection
      const backup = await new BackupService().createBackup({ excludePaths: [scheduler.destinationRoot()], source: 'move' });
      const { size } = await stat(backup.backupFile);

      Object.assign(record, {
        state: 'ready',
        archive: backup.backupFile,
        archiveDirectory: backup.backupDirectory,
        size,
        readyUntil: Date.now() + MOVE_READY_TTL_MS,
      });
      writeMoveRecord(this.configService.MOVE_FILE, record);
      this.logger.log('The backup for the move is packed and waits for the new server');
      this.armReadyTimer(record, restart);
    } catch (error) {
      record.state = 'failed';
      record.error = `The backup for the move could not be packed: ${error.message}`;
      writeMoveRecord(this.configService.MOVE_FILE, record);
      this.logger.error(record.error);
      restart();
    }
  }

  private armReadyTimer(record: MoveRecord, restart: () => void): void {
    clearTimeout(MoveService.readyTimer);

    const check = (): void => {
      const current = readMoveRecord(this.configService.MOVE_FILE);
      if (current?.state !== 'ready') return;

      const left = (current.readyUntil ?? 0) - Date.now();
      if (left > 0 || MoveService.transferred !== undefined) {
        MoveService.readyTimer = setTimeout(check, Math.max(left, SENDING_GRACE_MS));
        return;
      }

      removeMoveRecord(this.configService.MOVE_FILE, current);
      this.logger.warn('The new server did not fetch the backup in time, camera.ui runs on this server again');
      restart();
    };
    MoveService.readyTimer = setTimeout(check, Math.max(0, (record.readyUntil ?? 0) - Date.now()));
  }

  private finishSending(complete: boolean): void {
    MoveService.transferred = undefined;
    if (MoveService.sentDirectory) {
      remove(MoveService.sentDirectory).catch(() => {});
      MoveService.sentDirectory = undefined;
    }

    const record = readMoveRecord(this.configService.MOVE_FILE);
    if (record?.state !== 'ready') return;
    if (!complete) {
      this.logger.warn('Sending the backup broke off, the new server can fetch it again');
      return;
    }

    record.readyUntil = Date.now() + MOVE_READY_TTL_MS;
    writeMoveRecord(this.configService.MOVE_FILE, record);
    this.logger.log(`The backup went out to ${record.target ?? 'the new server'}, waiting for it to confirm`);
  }

  private authorize(secret: string): MoveRecord {
    const record = this.read();
    if (!record) throw new RestoreError('This server is not waiting for a move.', 404);
    if (!moveSecretMatches(record, secret)) throw new RestoreError('The move code is not valid.', 403);
    return record;
  }

  private peerView(record: MoveRecord): MovePeerStatus {
    return { state: record.state, version: ConfigService.VERSION, size: record.size, error: record.error };
  }

  private read(): MoveRecord | null {
    return MoveService.transferred === undefined ? settleMoveRecord(this.configService.MOVE_FILE) : readMoveRecord(this.configService.MOVE_FILE);
  }

  private servedFingerprint(): string {
    const served = new X509Certificate(this.configService.ssl.cert);
    try {
      const ca = new X509Certificate(readFileSync(this.configService.ROOT_CERT_FILE));
      if (served.checkIssued(ca) && served.verify(ca.publicKey)) return certificateFingerprint(ca.raw);
    } catch {
      // no own CA to pin
    }
    return certificateFingerprint(served.raw);
  }
}
