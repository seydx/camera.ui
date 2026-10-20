import { IS_DEV, IS_ELECTRON } from '@camera.ui/common/utils';
import { ensureDir, move, pathExists, readJson, remove, writeJson } from 'fs-extra/esm';
import { fork } from 'node:child_process';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { appendFile, lstat, mkdtemp, open, readdir, stat, statfs, utimes, writeFile } from 'node:fs/promises';
import { platform, tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { c, x } from 'tar';
import { container } from 'tsyringe';

import { ConfigService } from '../../services/config/index.js';
import { alignStagedPlatformValues } from '../../services/config/platform-values.js';
import { describeRestoredPlugins } from '../../services/config/restore-plugins.js';
import { browseCameraUi } from '../../services/mdns/browse.js';
import {
  assertRestorableVersion,
  BACKUP_IGNORE_FILE,
  dropsIngressAccount,
  isIngressAccount,
  isRestoreFinished,
  readRestoreJournal,
  readRestorePrevious,
  RESTORE_STATUS_TTL_MS,
  RESTORE_UPLOAD_CHUNK_SIZE,
  RestoreError,
  restoreStatus,
  updateRestoreJournal,
  writeRestoreJournal,
} from '../../services/config/restore.js';
import { restoreSummaryPath } from '../../utils/path.js';
import { PluginsService } from './plugins.service.js';

import type { MultipartFile } from '@fastify/multipart';
import type { CameraUi } from '../../main.js';
import type { LoggerService } from '../../services/logger/index.js';
import type {
  BackupDownloadLink,
  BackupExcludedFolder,
  BackupInfo,
  BackupJob,
  BackupJobPhase,
  BackupJobSource,
  BackupKeyInfo,
  BackupStorage,
  MovePeer,
  PluginBackupInfo,
  RestoreJournal,
  RestoreKind,
  RestoreMode,
  RestoreNotice,
  RestoreOverview,
  RestoreStarted,
  RestoreStatus,
  RestoreSummary,
  RestoreUpload,
  UiLocalStorage,
} from '../types/index.js';

export type UploadedBackupFile = MultipartFile & { filepath?: string };

export class BackupService {
  private static activeOperation: 'backup' | 'restore' | null = null;

  private logger: LoggerService;
  private configService: ConfigService;
  private pluginsService: PluginsService;

  constructor() {
    this.logger = container.resolve<LoggerService>('logger');
    this.configService = container.resolve<ConfigService>('configService');

    this.pluginsService = new PluginsService();
  }

  public async createBackup(localStorage: Partial<UiLocalStorage> = {}, extraExcludePaths: string[] = []): Promise<BackupStorage> {
    this.acquireLock('backup');

    try {
      if (file.filepath) {
        await move(file.filepath, archive, { overwrite: true });
      } else {
        await writeFile(archive, await file.toBuffer());
      }
      return await this.stage(archive, 'upload', undefined, key);
    } finally {
      await remove(directory).catch(() => {});
      if (file.filepath) await remove(dirname(file.filepath)).catch(() => {});
    }
  }

  public async stageArchive(archive: string, key?: string): Promise<RestoreStarted> {
    return this.stage(archive, 'archive', undefined, key);
  }

  public async stageMove(archive: string, peer: MovePeer): Promise<RestoreStarted> {
    return this.stage(archive, 'move', peer);
  }

  public async createUpload(size: number, name: string): Promise<RestoreUpload> {
    const id = randomBytes(16).toString('hex');
    await ensureDir(this.configService.RESTORE_UPLOADS_PATH);
    await writeJson(this.uploadMetaPath(id), { size, name, createdAt: Date.now() } satisfies UploadMeta);
    await writeFile(this.uploadPartPath(id), '');
    return { id, size, received: 0, chunkSize: RESTORE_UPLOAD_CHUNK_SIZE };
  }

  public async uploadStatus(id: string): Promise<RestoreUpload> {
    const meta = await this.readUploadMeta(id);
    const { size: received } = await stat(this.uploadPartPath(id));
    return { id, size: meta.size, received, chunkSize: RESTORE_UPLOAD_CHUNK_SIZE };
  }

  public async appendUpload(id: string, offset: number, chunk: Buffer): Promise<RestoreUpload> {
    if (BackupService.uploadsInFlight.has(id)) {
      throw new RestoreError('This upload is already receiving a part.', 409);
    }
    BackupService.uploadsInFlight.add(id);

    try {
      const upload = await this.uploadStatus(id);
      if (offset !== upload.received) {
        throw new RestoreError(`The upload continues at byte ${upload.received}.`, 409);
      }
      if (upload.received + chunk.length > upload.size) {
        throw new RestoreError('The part goes beyond the announced size.', 413);
      }

      await appendFile(this.uploadPartPath(id), chunk);
      // both upload files expire by mtime
      const now = new Date();
      await utimes(this.uploadMetaPath(id), now, now);
      return { ...upload, received: upload.received + chunk.length };
    } finally {
      BackupService.uploadsInFlight.delete(id);
    }
  }

  public async completeUpload(id: string, key?: string): Promise<RestoreStarted> {
    const upload = await this.uploadStatus(id);
    if (upload.received !== upload.size) {
      throw new RestoreError(`The upload is not complete, ${upload.received} of ${upload.size} bytes arrived.`, 409);
    }

    try {
      const started = await this.stage(this.uploadPartPath(id), 'upload', undefined, key);
      await this.removeUpload(id);
      return started;
    } catch (error) {
      // the page asks for the key and retries the same upload
      if (!(error instanceof RestoreError && error.code)) await this.removeUpload(id);
      throw error;
    }
  }

  public async removeUpload(id: string): Promise<void> {
    await remove(this.uploadPartPath(id));
    await remove(this.uploadMetaPath(id));
  }

  public overview(): RestoreOverview {
    const journal = readRestoreJournal(this.configService.RESTORE_JOURNAL_FILE);
    return {
      status: journal ? restoreStatus(journal) : null,
      previous: readRestorePrevious(this.configService.restorePaths),
    };
  }

  public statusFor(ticket: string | undefined): RestoreStatus | RestoreNotice | null {
    const journal = readRestoreJournal(this.configService.RESTORE_JOURNAL_FILE);
    if (!journal) return null;
    if (isRestoreFinished(journal) && Date.now() - (journal.finishedAt ?? journal.updatedAt) > RESTORE_STATUS_TTL_MS) return null;

    if (ticket && this.ticketMatches(journal, ticket)) {
      return restoreStatus(journal);
    }

    const { id, kind, state, updatedAt, finishedAt } = journal;
    return { id, kind, state, updatedAt, finishedAt };
  }

  public confirmRestore(mode?: RestoreMode): RestoreStatus {
    this.acquireLock('restore');

    try {
      this.assertRestoreWaiting();
      const updated = updateRestoreJournal(this.configService.RESTORE_JOURNAL_FILE, (current) => {
        current.state = 'confirmed';
        current.mode = mode ?? current.summary?.suggestedMode ?? 'copy';
        // from here the old server must stay stopped
        delete current.movePeer;
      });
      this.logger.log(`Restore confirmed as a ${updated!.mode}, restarting to apply it`);
      return restoreStatus(updated!);
    } finally {
      BackupService.activeOperation = null;
    }
  }

  public async cancelRestore(): Promise<RestoreStatus> {
    this.acquireLock('restore');

    try {
      this.assertRestoreWaiting();
      await remove(this.configService.RESTORE_STAGING_PATH);
      const updated = updateRestoreJournal(this.configService.RESTORE_JOURNAL_FILE, (current) => {
        current.state = 'cancelled';
        current.finishedAt = Date.now();
      });
      this.logger.log('Restore cancelled');
      return restoreStatus(updated!);
    } finally {
      BackupService.activeOperation = null;
    }
  }

  public async startUndo(): Promise<RestoreStarted> {
    this.acquireLock('restore');

    try {
      this.assertNoRestoreRunning();

      const previous = readRestorePrevious(this.configService.restorePaths);
      if (!previous) {
        throw new RestoreError('There is no earlier state to go back to.', 409);
      }

      const facts = await this.readArchiveFacts(this.configService.RESTORE_PREVIOUS_PATH);
      const summary = { ...this.summarize({ version: ConfigService.VERSION, platform: platform(), timestamp: previous.createdAt }, facts), cloud: facts?.cloud ?? false };

      const { ticket, journal } = this.newJournal('undo', summary, []);
      journal.state = 'confirmed';
      writeRestoreJournal(this.configService.RESTORE_JOURNAL_FILE, journal);

      this.logger.log('Undo of the last restore confirmed, restarting to apply it');
      return { ticket, status: restoreStatus(journal), localStorage: {} };
    } finally {
      BackupService.activeOperation = null;
    }
  }

  public async discardPlugin(name: string): Promise<RestoreStatus> {
    const journal = readRestoreJournal(this.configService.RESTORE_JOURNAL_FILE);
    const plugin = journal?.plugins.find((entry) => entry.name === name);
    if (!journal || !plugin || plugin.state === 'installed') {
      throw new RestoreError(`${name} is not waiting to be installed.`, 409);
    }

    const info: BackupInfo | null = await readJson(this.configService.BACKUP_INFO_FILE).catch(() => null);
    if (info) {
      const installed = new Set(journal.plugins.filter((entry) => entry.state === 'installed').map((entry) => entry.name));
      info.plugins = info.plugins.filter((entry) => entry.name !== name);
      if (info.plugins.every((entry) => installed.has(entry.name))) await remove(this.configService.BACKUP_INFO_FILE);
      else await writeJson(this.configService.BACKUP_INFO_FILE, info);
    }

    const updated = updateRestoreJournal(this.configService.RESTORE_JOURNAL_FILE, (current) => {
      for (const entry of current.plugins) {
        if (entry.name === name) entry.state = 'discarded';
      }
      if (current.state === 'done-with-problems' && !current.plugins.some((entry) => entry.state === 'failed' || entry.state === 'pending')) {
        current.state = 'done';
      }
    });

    this.logger.log(`Plugin ${name} from the backup is no longer installed on start`);
    return restoreStatus(updated!);
  }

  public async removeBackup(backup: BackupStorage): Promise<void> {
    await remove(backup.backupDirectory);
  }

  private acquireLock(operation: 'backup' | 'restore'): void {
    if (BackupService.activeOperation) {
      throw new RestoreError(`A ${BackupService.activeOperation} operation is already in progress. Please wait for it to finish and try again.`, 409);
    }
    BackupService.activeOperation = operation;
  }

  private async runCreateBackup(localStorage: Partial<UiLocalStorage>, extraExcludePaths: string[]): Promise<BackupStorage> {
    const timestamp = Date.now();
    const backupDirectory = await mkdtemp(join(tmpdir(), 'camera.ui-backup-'));
    const backupFileName = `camera.ui-backup-${timestamp}.tar.gz`;
    const backupFile = join(backupDirectory, backupFileName);

    this.logger.log('Creating new backup...');

    const plugins = this.pluginsService.listPlugins();
    const pluginsInfo: PluginBackupInfo[] = plugins.map((plugin): PluginBackupInfo => ({
      id: plugin.id,
      name: plugin.pluginName,
      version: plugin.info.installedVersion ?? 'latest',
    }));

    const excludePaths = [
      this.configService.INTERFACE_CACHE_PATH,
      this.configService.LOGS_PATH,
      this.configService.LOG_FILE,
      this.configService.PIDS_FILE,
      this.configService.REPORTS_FILE,
      this.configService.BACKUP_INFO_FILE,
      this.configService.ROOT_CERT_FILE,
      this.configService.HOST_CERT_FILE,
      this.configService.HOST_KEY_FILE,
      this.configService.ROOT_KEY_FILE,
      ...extraExcludePaths,
    ].map((path) => resolve(path));

    const isExcluded = (filePath: string): boolean => {
      const normalized = resolve(filePath);
      return excludePaths.some((excluded) => normalized === excluded || normalized.startsWith(excluded + sep));
    };

    await copy(this.configService.STORAGE_PATH, join(backupDirectory, 'storage'), {
      filter: async (filePath: string) => {
        if (isExcluded(filePath)) {
          return false;
        }

        try {
          const stat = await lstat(filePath);
          if (stat.isDirectory()) {
            if (await pathExists(join(filePath, '.backupignore'))) {
              return false;
            }
            return true;
          }
          return stat.isFile();
        } catch {
          return false;
        }
      },
    });

    const info: BackupInfo = {
      timestamp,
      platform: platform(),
      node: process.version,
      version: ConfigService.VERSION,
      plugins: pluginsInfo,
      localStorage: localStorage,
    };

    await writeJson(join(backupDirectory, 'camera.ui.backup.json'), info);

    await c(
      {
        portable: true,
        gzip: true,
        file: backupFile,
        cwd: backupDirectory,
      },
      ['storage', 'camera.ui.backup.json'],
    );

    this.logger.log('Backup was successfully created');

    return {
      backupDirectory,
      backupFile,
      backupFileName,
    };
  }

  private ensureStartupComplete(): void {
    const cameraui = container.resolve<CameraUi>('cameraui');
    if (cameraui.status !== 'ready') {
      throw new Error('The server is still starting up. Please wait a moment and try again.');
    }
  }

  private async removeUploadedFile(file: UploadedBackupFile): Promise<void> {
    if (file.filepath) {
      await remove(dirname(file.filepath)).catch(() => {});
    }
  }

  private async runRestoreBackup(file: UploadedBackupFile): Promise<any> {
    this.ensureStartupComplete();

    const uploadDirectory = await mkdtemp(join(tmpdir(), 'cameraui-restore-'));
    const backupFile = join(uploadDirectory, 'upload.tar.gz');

    if (file.filepath) {
      await move(file.filepath, backupFile, { overwrite: true });
    } else {
      await writeFile(backupFile, await file.toBuffer());
    }

  private async stage(archive: string, kind: RestoreKind, peer?: MovePeer, key?: string): Promise<RestoreStarted> {
    this.acquireLock('restore');

    try {
      this.assertNoRestoreRunning();
      return await this.extractStaged(archive, kind, peer, key);
    } finally {
      BackupService.activeOperation = null;
    }
  }

  private async extractStaged(archive: string, kind: RestoreKind, peer?: MovePeer, key?: string): Promise<RestoreStarted> {
    const stagingPath = this.configService.RESTORE_STAGING_PATH;

    try {
      const journal = readRestoreJournal(this.configService.RESTORE_JOURNAL_FILE);
      if (journal?.state === 'ready') {
        updateRestoreJournal(this.configService.RESTORE_JOURNAL_FILE, (current) => {
          current.state = 'cancelled';
          current.finishedAt = Date.now();
        });
      }

      await remove(stagingPath);
      await ensureDir(stagingPath);

      await x({
        cwd: stagingPath,
        file: backupFile,
      });

      const infoPath = join(stagingPath, 'camera.ui.backup.json');
      const storagePath = join(stagingPath, 'storage');

      if (!(await pathExists(infoPath)) || !(await pathExists(storagePath))) {
        throw new RestoreError('The file is not a camera.ui backup archive.');
      }

      const info: BackupInfo = await readJson(infoPath);
      this.logger.debug('Backup archive information:', info);
      assertRestorableVersion(info.version, ConfigService.VERSION);

      const facts = await this.readArchiveFacts(storagePath);
      const [identity, plugins] = await Promise.all([
        this.describeIdentity(storagePath, facts, kind),
        describeRestoredPlugins(info.plugins, ConfigService.VERSION, facts?.pluginWorkers),
      ]);
      const backedUp = new Set(info.plugins.map((plugin) => plugin.name));
      const notInBackup = this.pluginsService
        .listPlugins()
        .map((plugin) => plugin.pluginName)
        .filter((name) => !backedUp.has(name));
      const summary: RestoreSummary = {
        ...this.summarize(info, facts, dropsIngressAccount(info, !!this.configService.INGRESS_TRUST_IP)),
        ...identity,
        platformChanges: await alignStagedPlatformValues(storagePath, info.environment),
        ...(info.excluded?.length && { excluded: info.excluded }),
        ...(notInBackup.length && { pluginsNotInBackup: notInBackup }),
      };
      const started = this.newJournal(kind, summary, plugins);
      if (peer) started.journal.movePeer = peer;
      writeRestoreJournal(this.configService.RESTORE_JOURNAL_FILE, started.journal);

      this.logger.log(`Backup from camera.ui ${info.version} is staged and waits to be confirmed`);
      return { ticket: started.ticket, status: restoreStatus(started.journal), localStorage: info.localStorage ?? {} };
    } catch (error) {
      await remove(stagingPath).catch(() => {});
      throw error;
    }
  }

      const infoFile: BackupInfo = await readJson(infoPath);

      this.logger.debug('Backup Archive Information:', infoFile);

  private unpackError(error: NodeJS.ErrnoException & { code?: string }): RestoreError {
    if (error instanceof RestoreError) return error;
    if (error.code === 'ENOSPC') return new RestoreError(`Not enough free space to unpack the backup in ${this.configService.RESTORE_PATH}.`, 507);
    if (error instanceof BackupArchiveError) {
      return new RestoreError(error.code === 'incomplete' ? 'The backup archive is incomplete. Copy or download it again.' : 'The backup archive is damaged.');
    }
    if (error.code === 'Z_BUF_ERROR' || /unexpected end of file|truncated/i.test(error.message)) {
      return new RestoreError('The backup archive is incomplete. Copy or download it again.');
    }
    return new RestoreError('The file is not a camera.ui backup archive.');
  }

  private newJournal(kind: RestoreKind, summary: RestoreSummary, plugins: RestoreJournal['plugins']): { ticket: string; journal: RestoreJournal } {
    const ticket = randomBytes(24).toString('base64url');
    const now = Date.now();
    return {
      ticket,
      journal: {
        id: randomUUID(),
        kind,
        state: 'ready',
        createdAt: now,
        updatedAt: now,
        summary,
        plugins,
        ticketHash: hashTicket(ticket),
        boots: 0,
      },
    };
  }

  private ticketMatches(journal: RestoreJournal, ticket: string): boolean {
    const expected = Buffer.from(journal.ticketHash, 'hex');
    const actual = Buffer.from(hashTicket(ticket), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private assertRestoreWaiting(): void {
    if (readRestoreJournal(this.configService.RESTORE_JOURNAL_FILE)?.state !== 'ready') {
      throw new RestoreError('There is no restore waiting to be confirmed.', 409);
    }
  }

  private assertNoRestoreRunning(): void {
    const journal = readRestoreJournal(this.configService.RESTORE_JOURNAL_FILE);
    if (journal?.state === 'confirmed' || journal?.state === 'applied') {
      throw new RestoreError('A restore is being applied right now. Wait until it is finished.', 409);
    }
  }

  private summarize(info: Pick<BackupInfo, 'version' | 'platform' | 'timestamp'>, facts: RestoreArchiveFacts | undefined, dropsIngress = false): RestoreSummary {
    const accounts = (facts?.accounts ?? []).filter((account) => !dropsIngress || !isIngressAccount(account));
    return { version: info.version, platform: info.platform, createdAt: info.timestamp, cameras: facts?.cameras ?? 0, accounts };
  }

  private async describeIdentity(storagePath: string, facts: RestoreArchiveFacts | undefined, kind: RestoreKind): Promise<Partial<RestoreSummary>> {
    const dbs = inject('dbs');
    const sameServer = !!facts?.instanceId && facts.instanceId === dbs.settingsDB.get('settings')?.instanceId;
    const [certificate, source] = await Promise.all([
      this.hasCertificateAuthority(storagePath),
      sameServer || kind === 'move' ? undefined : this.findRunningSource(facts?.instanceId),
    ]);

    return {
      suggestedMode: kind === 'move' || sameServer || dbs.camerasDB.getKeysCount() === 0 ? 'move' : 'copy',
      sameServer,
      certificate,
      cloud: facts?.cloud ?? false,
      workers: facts?.workers ?? 0,
      ...source,
    };
  }

  private async findRunningSource(instanceId: string | undefined): Promise<Pick<RestoreSummary, 'sourceRunning' | 'sourceUnchecked'> | undefined> {
    if (!instanceId || this.configService.config.mdns === false) return undefined;

    const { servers, failure } = await browseCameraUi(SOURCE_BROWSE_MS);
    if (failure) {
      this.logger.debug(`Could not look for the server of the backup on this network: ${failure}`);
      // macOS answers multicast with EHOSTUNREACH until the app may use the local network
      return { sourceUnchecked: platform() === 'darwin' && failure === 'EHOSTUNREACH' ? 'local-network' : 'network' };
    }

    const addresses = servers.filter((server) => server.id === instanceId).flatMap((server) => server.addresses.map((address) => `${address}:${server.port}`));
    return addresses.length ? { sourceRunning: addresses } : undefined;
  }

  private async hasCertificateAuthority(storagePath: string): Promise<boolean> {
    const { ROOT_CERT_FILE, ROOT_KEY_FILE, STORAGE_PATH } = this.configService;
    const found = await Promise.all([ROOT_CERT_FILE, ROOT_KEY_FILE].map((file) => pathExists(join(storagePath, relative(STORAGE_PATH, file)))));
    return found.every(Boolean);
  }

  private async readArchiveFacts(storagePath: string): Promise<RestoreArchiveFacts | undefined> {
    const databasePath = join(storagePath, 'database');
    if (!(await pathExists(join(databasePath, 'data.mdb')))) {
      this.logger.warn('The backup has no database, it restores without accounts and cameras');
      return undefined;
    }

    return new Promise((resolve, reject) => {
      let result: RestoreArchiveFacts | undefined;
      let stderr = '';

      const child = fork(restoreSummaryPath, [databasePath], {
        silent: true,
        windowsHide: true,
        timeout: SUMMARY_TIMEOUT_MS,
        execArgv: IS_DEV && !IS_ELECTRON ? ['--import=tsx'] : undefined,
      });

      child.stderr?.on('data', (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));
      child.on('message', (message: RestoreArchiveFacts) => (result = message));
      child.once('error', (error) => {
        this.logger.warn('Could not read the accounts and cameras of the backup', error);
        resolve(undefined);
      });
      child.once('exit', (code, signal) => {
        if (result) {
          resolve(result);
          return;
        }

        this.logger.warn(`Reading the database of the backup failed (code ${code}, signal ${signal}): ${stderr.trim()}`);
        reject(new RestoreError('The database in this backup is damaged.'));
      });
    });
  }

  private async readUploadMeta(id: string): Promise<UploadMeta> {
    try {
      return await readJson(this.uploadMetaPath(id));
    } catch {
      throw new RestoreError('This upload does not exist or has expired.', 404);
    }
  }

  private uploadMetaPath(id: string): string {
    return join(this.configService.RESTORE_UPLOADS_PATH, `${id}.json`);
  }

  private uploadPartPath(id: string): string {
    return join(this.configService.RESTORE_UPLOADS_PATH, `${id}.part`);
  }
}

function hashTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}

async function isSqlite(path: string): Promise<boolean> {
  const file = await open(path, 'r').catch(() => null);
  if (!file) return false;
  try {
    const head = Buffer.alloc(SQLITE_HEADER.length);
    await file.read(head, 0, head.length, 0);
    return head.equals(SQLITE_HEADER);
  } finally {
    await file.close();
  }
}

async function snapshotSqlite(source: string, target: string): Promise<boolean> {
  const sqlite = await import('node:sqlite').catch(() => null);
  if (!sqlite?.backup) return false;

  let db: DatabaseSync | undefined;
  try {
    await ensureDir(dirname(target));
    db = new sqlite.DatabaseSync(source, { readOnly: true, timeout: SQLITE_BUSY_TIMEOUT_MS });
    await sqlite.backup(db, target);
    return true;
  } catch {
    await remove(target).catch(() => {});
    return false;
  } finally {
    db?.close();
  }
}

async function folderSize(path: string, deadline: number): Promise<number | undefined> {
  let size = 0;
  for (const name of await readdir(path).catch(() => [])) {
    if (Date.now() > deadline) return undefined;
    const stats = await lstat(join(path, name)).catch(() => null);
    if (!stats) continue;
    if (stats.isDirectory()) {
      const inner = await folderSize(join(path, name), deadline);
      if (inner === undefined) return undefined;
      size += inner;
    } else if (stats.isFile()) {
      size += stats.size;
    }
  }
  return size;
}
