import type { Migration } from './types.js';

interface LegacySnapshotSettings {
  mode?: string;
  autoRefresh?: boolean;
  ttl?: number;
  interval?: number;
}

const migration: Migration = {
  version: '2.2.3',
  description: 'snapshot settings carry a refresh mode instead of the auto refresh switch and the cache time',
  async up(ctx) {
    await ctx.db.camerasDB.transaction(() => {
      for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
        const legacy = camera.snapshotSettings as LegacySnapshotSettings;
        if (legacy.mode) continue;
        camera.snapshotSettings = {
          mode: legacy.autoRefresh === false ? 'onView' : 'interval',
          interval: legacy.interval ?? 60,
          maxAge: legacy.ttl ?? 60,
        };
        ctx.db.camerasDB.put(key, camera);
        ctx.logger.log(`Camera "${camera.name}": snapshot refresh mode "${camera.snapshotSettings.mode}"`);
      }
    });
  },
};

export default migration;
