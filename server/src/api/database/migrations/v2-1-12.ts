import type { Migration, MigrationContext } from './types.js';

const DEFAULT_PLATE_CONFIDENCE = 0.3;

async function splitPlateConfidence(ctx: MigrationContext): Promise<void> {
  await ctx.db.camerasDB.transaction(() => {
    for (const { key, value: camera } of ctx.db.camerasDB.getRange()) {
      const plate = camera.detectionSettings?.licensePlate;
      if (!plate || plate.ocrConfidence !== undefined) continue;

      plate.ocrConfidence = plate.confidence;
      plate.confidence = DEFAULT_PLATE_CONFIDENCE;
      ctx.db.camerasDB.put(key, camera);
      ctx.logger.log(`Camera "${camera.name}": plate reading confidence kept at ${plate.ocrConfidence}, detection starts at ${DEFAULT_PLATE_CONFIDENCE}`);
    }
  });
}

const migration: Migration = {
  version: '2.1.12',
  description: 'license plates get their own detection and reading confidence',
  async up(ctx) {
    await splitPlateConfidence(ctx);
  },
};

export default migration;
