import { updatesService } from '../services/updates.service.js';

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthLoginRequest, UpdatesRunRequest } from '../types/index.js';

export class UpdatesController {
  public status(_req: FastifyRequest<AuthLoginRequest>, reply: FastifyReply): FastifyReply {
    try {
      return reply.code(200).send(updatesService().status());
    } catch (error: any) {
      return reply.code(500).send({ statusCode: 500, message: error.message });
    }
  }

  public async run(req: FastifyRequest<AuthLoginRequest & UpdatesRunRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const run = await updatesService().runAll({ confirmWorkers: req.body?.confirmWorkers });
      return reply.code(201).send(run);
    } catch (error: any) {
      const statusCode = error.statusCode ?? 500;
      return reply.code(statusCode).send({ statusCode, message: error.message, workers: error.workers, target: error.target });
    }
  }

  public cancel(_req: FastifyRequest<AuthLoginRequest>, reply: FastifyReply): FastifyReply {
    try {
      updatesService().cancelRun();
      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({ statusCode: 500, message: error.message });
    }
  }

  public async check(_req: FastifyRequest<AuthLoginRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      await updatesService().checkNow();
      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({ statusCode: 500, message: error.message });
    }
  }
}
