import * as zod from 'zod';

export const runUpdatesSchema = zod
  .object({
    confirmWorkers: zod.boolean().optional(),
  })
  .strict()
  .optional();

export type RunUpdatesInput = zod.output<typeof runUpdatesSchema>;
