import type { DBTrainingCandidateBox } from '../types.js';
import type { Migration } from './types.js';

function outsideFrame(box: DBTrainingCandidateBox): boolean {
  return box.x < 0 || box.y < 0 || box.x + box.width > 1 || box.y + box.height > 1;
}

function framed(box: DBTrainingCandidateBox): DBTrainingCandidateBox {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  return { ...box, x, y, width: Math.min(1, box.x + box.width) - x, height: Math.min(1, box.y + box.height) - y };
}

const migration: Migration = {
  version: '2.3.1',
  description: 'training candidate boxes stay inside the picture',
  async up(ctx) {
    await ctx.db.trainingCandidatesDB.transaction(() => {
      let moved = 0;
      for (const { key, value: candidate } of ctx.db.trainingCandidatesDB.getRange()) {
        if (!candidate.boxes.some(outsideFrame) && !candidate.proposals?.some(outsideFrame)) continue;
        ctx.db.trainingCandidatesDB.put(key, {
          ...candidate,
          boxes: candidate.boxes.map(framed),
          ...(candidate.proposals ? { proposals: candidate.proposals.map(framed) } : {}),
          ...(candidate.upload === 'failed' ? { upload: undefined, uploadError: undefined } : {}),
        });
        moved++;
      }
      ctx.logger.log(`Training candidates moved inside the picture: ${moved}`);
    });
  },
};

export default migration;
