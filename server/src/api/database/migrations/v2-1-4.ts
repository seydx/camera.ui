import type { Migration, MigrationContext } from './types.js';

async function migrateFrameWorkerSettings(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const settings = camera.frameWorkerSettings as (typeof camera.frameWorkerSettings & { fps?: number; hqSnapshots?: boolean }) | undefined;
      if (!settings) continue;

      const hadFps = settings.fps !== undefined;
      const hadHq = settings.hqSnapshots !== undefined;
      if (!hadFps && !hadHq) continue;

      // the old switch picked the thumbnail stream, its value carries over unchanged
      if (hadHq) {
        settings.mainStreamAnalysis = settings.hqSnapshots === true;
        delete settings.hqSnapshots;
      }
      delete settings.fps;

      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": frame worker settings moved to main stream analysis`);
    }
  });
}

const migration: Migration = {
  version: '2.1.4',
  description: 'frame worker fps is dropped and hqSnapshots becomes mainStreamAnalysis',
  async up(ctx) {
    await migrateFrameWorkerSettings(ctx);
  },
};

export default migration;
