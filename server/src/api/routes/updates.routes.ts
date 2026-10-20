import { UpdatesController } from '../controllers/updates.controller.js';
import { onlyAdminCanDoThisAction } from '../middlewares/authPermission.middleware.js';
import { validJWTNeeded } from '../middlewares/authValidation.middleware.js';
import { runUpdatesSchema } from '../schemas/updates.schema.js';

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

export const UpdatesRoute: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const updatesController = new UpdatesController();

  app.route({
    url: '/status',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: updatesController.status.bind(updatesController),
    schema: {
      tags: ['Updates'],
      summary: 'Current update activity, the last run and everything pending',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/run',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: updatesController.run.bind(updatesController),
    schema: {
      tags: ['Updates'],
      summary: 'Update everything: workers onto the target version, plugins without restart, the server last',
      description: 'Answers 409 with the workers that would no longer connect after the server update, unless confirmWorkers is set.',
      body: runUpdatesSchema,
    },
  });

  app.route({
    url: '/cancel',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: updatesController.cancel.bind(updatesController),
    schema: {
      tags: ['Updates'],
      summary: 'Cancel the active update run after the current item',
    },
  });

  app.route({
    url: '/check',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: updatesController.check.bind(updatesController),
    schema: {
      tags: ['Updates'],
      summary: 'Re-check every update source now (rate-limited)',
    },
  });
};
