import { createHash, randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { container } from 'tsyringe';

import { Database } from '../database/index.js';

import type { KnownWorker } from '../../workers/types.js';
import type { DBSettings, DBWorkerConnection, DBWorkerCredential, DBWorkerLastShutdown, DBWorkerPairing, DBWorkerRelease, DBWorkerState } from '../database/types.js';

const PAIRING_TTL_MS = 15 * 60 * 1000;
const BOOT_HISTORY = 3;
const USED_CODES_KEPT = 50;

export class WorkersService {
  private dbs: Database;

  constructor() {
    this.dbs = container.resolve<Database>('dbs');
  }

  public getOrCreateAgentId(workerName: string): string {
    const existing = this.dbs.workerStateDB.get('state');
    if (existing?.agentId) return existing.agentId;

    const agentId = createHash('sha256').update(`${hostname()}:${workerName}:${Date.now()}`).digest('hex').slice(0, 16);

    this.dbs.workerStateDB.putSync('state', { agentId });
    return agentId;
  }

  public getWorkerConnection(): DBWorkerConnection | undefined {
    return this.dbs.workerStateDB.get('state')?.connection;
  }

  public saveWorkerConnection(connection: DBWorkerConnection): void {
    const state = this.workerState();
    const legacy = state.connection?.pairingCode;
    const usedCodes = legacy ? withHash(state.usedCodes, codeHash(legacy)) : state.usedCodes;
    this.dbs.workerStateDB.putSync('state', { ...state, connection, usedCodes, unpaired: undefined });
  }

  public rotateBootIds(bootId: string): string[] {
    const state = this.workerState();
    const previous = (state.bootIds ?? []).slice(0, BOOT_HISTORY);
    this.dbs.workerStateDB.putSync('state', { ...state, bootIds: [bootId, ...previous].slice(0, BOOT_HISTORY + 1) });
    return previous;
  }

  public markUnpaired(reason: string): void {
    const state = this.dbs.workerStateDB.get('state');
    if (!state) {
      return;
    }
    this.dbs.workerStateDB.putSync('state', { ...state, unpaired: { reason, at: Date.now() } });
  }

  public getUnpaired(): { reason: string; at: number } | undefined {
    return this.dbs.workerStateDB.get('state')?.unpaired;
  }

  public isCodeUsed(code: string): boolean {
    const state = this.dbs.workerStateDB.get('state');
    return state?.connection?.pairingCode === code || (state?.usedCodes ?? []).includes(codeHash(code));
  }

  public markCodeUsed(code: string, refusal?: string): void {
    const state = this.workerState();
    const hash = codeHash(code);
    if (!state.usedCodes?.includes(hash) || refusal) {
      const refused = refusal ? { hash, reason: refusal } : state.refused;
      this.dbs.workerStateDB.putSync('state', { ...state, usedCodes: withHash(state.usedCodes, hash), refused });
    }
  }

  public refusalOf(code: string): string | undefined {
    const refused = this.dbs.workerStateDB.get('state')?.refused;
    return refused?.hash === codeHash(code) ? refused.reason : undefined;
  }

  public listKnownWorkers(): KnownWorker[] {
    return this.dbs.settingsDB.get('settings')?.knownWorkers ?? [];
  }

  public async rememberWorker(agentId: string, name: string): Promise<void> {
    await this.commitSettings((settings) => {
      const known = settings.knownWorkers ?? [];
      const existing = known.find((worker) => worker.agentId === agentId);

      if (existing) {
        // Only persist on change — this runs on every heartbeat.
        if (existing.name === name && Date.now() - existing.lastSeen < 60_000) {
          return undefined;
        }
        existing.name = name;
        existing.lastSeen = Date.now();
      } else {
        known.push({ agentId, name, lastSeen: Date.now() });
      }

      settings.knownWorkers = known;

      return settings;
    });
  }

  public getLastShutdown(): DBWorkerLastShutdown | undefined {
    return this.dbs.settingsDB.get('settings')?.workerLastShutdown;
  }

  public async saveLastShutdown(lastShutdown: DBWorkerLastShutdown): Promise<void> {
    await this.commitSettings((settings) => ({ ...settings, workerLastShutdown: lastShutdown }));
  }

  public getReleases(): Record<string, DBWorkerRelease> {
    return this.dbs.settingsDB.get('settings')?.workerReleases ?? {};
  }

  public async saveRelease(key: string, release: DBWorkerRelease | undefined): Promise<void> {
    await this.commitSettings((settings) => {
      const releases = { ...settings.workerReleases };
      if (release) {
        releases[key] = release;
      } else if (key in releases) {
        delete releases[key];
      } else {
        return undefined;
      }
      return { ...settings, workerReleases: releases };
    });
  }

  public getUpdates(): Record<string, WorkerUpdate> {
    return this.dbs.settingsDB.get('settings')?.workerUpdates ?? {};
  }

  public async saveUpdate(agentId: string, update: WorkerUpdate | undefined): Promise<void> {
    await this.commitSettings((settings) => {
      const updates = { ...settings.workerUpdates };
      if (update) {
        updates[agentId] = update;
      } else if (agentId in updates) {
        delete updates[agentId];
      } else {
        return undefined;
      }
      return { ...settings, workerUpdates: updates };
    });
  }

  public getWorkerDisplayName(agentId: string): string | undefined {
    return this.listKnownWorkers().find((worker) => worker.agentId === agentId)?.displayName;
  }

  public async renameWorker(agentId: string, displayName: string): Promise<void> {
    if (!this.listKnownWorkers().some((worker) => worker.agentId === agentId)) {
      throw new Error(`Worker ${agentId} is unknown`);
    }

    await this.commitSettings((settings) => {
      const known = settings.knownWorkers?.find((worker) => worker.agentId === agentId);
      if (!known) return undefined;

      known.displayName = displayName;

      return settings;
    });
  }

  public getWorkerServerAddresses(agentId: string): string[] {
    return this.listKnownWorkers().find((worker) => worker.agentId === agentId)?.serverAddresses ?? [];
  }

  public async setWorkerServerAddresses(agentId: string, serverAddresses: string[]): Promise<void> {
    if (!this.listKnownWorkers().some((worker) => worker.agentId === agentId)) {
      throw new Error(`Worker ${agentId} is unknown`);
    }

    await this.commitSettings((settings) => {
      const known = settings.knownWorkers?.find((worker) => worker.agentId === agentId);
      if (!known) return undefined;

      known.serverAddresses = serverAddresses;

      return settings;
    });
  }

  public async forgetWorker(agentId: string): Promise<void> {
    await this.commitSettings((settings) => {
      if (!settings.knownWorkers?.length) return undefined;

      settings.knownWorkers = settings.knownWorkers.filter((worker) => worker.agentId !== agentId);

      return settings;
    });
  }

  public async createPairingCode(replaces?: string): Promise<DBWorkerPairing> {
    const pairing: DBWorkerPairing = {
      code: randomBytes(8).toString('base64url'),
      expiresAt: Date.now() + PAIRING_TTL_MS,
      ...(replaces ? { replaces } : {}),
    };

    await this.commitSettings((settings) => {
      settings.workerPairings = [...this.prunePairings(settings), pairing];

      return settings;
    });

    return pairing;
  }

  public findPairing(code: string): DBWorkerPairing | undefined {
    const settings = this.readSettings();
    return this.prunePairings(settings).find((pairing) => pairing.code === code);
  }

  public async consumePairingCode(code: string): Promise<void> {
    await this.commitSettings((settings) => {
      settings.workerPairings = this.prunePairings(settings).filter((pairing) => pairing.code !== code);

      return settings;
    });
  }

  public listCredentials(): DBWorkerCredential[] {
    return this.dbs.settingsDB.get('settings')?.workerCredentials ?? [];
  }

  public async issueCredentials(agentId: string, name: string): Promise<DBWorkerCredential> {
    const credential: DBWorkerCredential = {
      agentId,
      name,
      user: `worker-${agentId}`,
      secret: randomBytes(32).toString('base64url'),
      createdAt: Date.now(),
    };

    await this.commitSettings((settings) => {
      settings.workerCredentials = [...(settings.workerCredentials ?? []).filter((cred) => cred.agentId !== agentId), credential];

      return settings;
    });

    return credential;
  }

  public async revokeCredentials(agentId: string): Promise<boolean> {
    const settings = await this.commitSettings((current) => {
      const credentials = current.workerCredentials ?? [];
      const remaining = credentials.filter((cred) => cred.agentId !== agentId);

      if (remaining.length === credentials.length) {
        return undefined;
      }

      current.workerCredentials = remaining;

      return current;
    });

    return settings !== undefined;
  }

  private workerState(): DBWorkerState {
    const state = this.dbs.workerStateDB.get('state');
    if (!state) {
      throw new Error('Worker state not initialized');
    }
    return state;
  }

  private readSettings(): DBSettings {
    return this.dbs.settingsDB.get('settings') ?? { version: Database.VERSION };
  }

  private async commitSettings(apply: (settings: DBSettings) => DBSettings | undefined): Promise<DBSettings | undefined> {
    return this.dbs.commit(this.dbs.settingsDB, 'settings', (current) => apply(current ?? { version: Database.VERSION }));
  }

  private prunePairings(settings: DBSettings): DBWorkerPairing[] {
    return (settings.workerPairings ?? []).filter((pairing) => pairing.expiresAt > Date.now());
  }
}

function codeHash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function withHash(hashes: string[] | undefined, hash: string): string[] {
  return [...(hashes ?? []).filter((known) => known !== hash), hash].slice(-USED_CODES_KEPT);
}
