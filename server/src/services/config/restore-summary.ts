import { open } from 'lmdb';

import { CAMERAS_ID, CLOUD_ID, DATABASE_ID, PLUGINS_ID, SETTINGS_ID, USERS_ID } from '../../api/database/constants.js';

import type { DBCloud, DBPlugin, DBSettings, DBUser } from '../../api/database/types.js';
import type { RestoreAccount } from '../../api/types/index.js';

export interface RestoreArchiveFacts {
  accounts: RestoreAccount[];
  cameras: number;
  instanceId?: string;
  cloud: boolean;
  workers: number;
  pluginWorkers: Record<string, string>;
}

const db = open({ path: process.argv[2], name: DATABASE_ID, maxDbs: 48, readOnly: true });

try {
  const users = db.openDB<DBUser, string>({ name: USERS_ID });
  const settings = db.openDB<DBSettings, string>({ name: SETTINGS_ID }).get('settings');
  const cloud = db.openDB<DBCloud, string>({ name: CLOUD_ID }).get('cloud');
  const facts: RestoreArchiveFacts = {
    accounts: Array.from(users.getRange(), ({ value }) => ({ username: value.username, role: value.role })),
    cameras: db.openDB({ name: CAMERAS_ID }).getKeysCount(),
    instanceId: settings?.instanceId,
    cloud: !!cloud?.oauth?.server_id,
    workers: settings?.knownWorkers?.length ?? 0,
    pluginWorkers: pluginWorkers(settings),
  };
  process.send!(facts, () => process.exit(0));
} finally {
  await db.close();
}

function pluginWorkers(settings: DBSettings | undefined): Record<string, string> {
  const names = new Map(settings?.knownWorkers?.map((worker) => [worker.agentId, worker.displayName ?? worker.name]));
  const workers: Record<string, string> = {};
  try {
    for (const { value } of db.openDB<DBPlugin, string>({ name: PLUGINS_ID }).getRange()) {
      if (value.workerAgentId) workers[value.pluginName] = names.get(value.workerAgentId) ?? value.workerAgentId;
    }
  } catch {
    // no plugin database yet, read-only cannot create it
  }
  return workers;
}
