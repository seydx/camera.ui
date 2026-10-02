import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthLoginRequest, AuthParamsRequest } from '../types/index.js';

export function isAdminRequest(req: FastifyRequest<AuthLoginRequest>): boolean {
  const role = req.locals.user?.role;
  return role === 'admin' || role === 'master';
}

export async function onlyMasterCanDoThisAction(req: FastifyRequest<AuthLoginRequest>, reply: FastifyReply): Promise<FastifyReply> {
  if (req.locals.user?.role !== 'master') {
    return reply.code(403).send({
      statusCode: 403,
      message: 'Forbidden',
    });
  }

  return {} as FastifyReply;
}

export async function onlyAdminCanDoThisAction(req: FastifyRequest<AuthLoginRequest>, reply: FastifyReply): Promise<FastifyReply> {
  if (!isAdminRequest(req)) {
    return reply.code(403).send({
      statusCode: 403,
      message: 'Forbidden',
    });
  }

  return {} as FastifyReply;
}

export async function onlySameUserOrAdminCanDoThisAction(req: FastifyRequest<AuthLoginRequest & AuthParamsRequest>, reply: FastifyReply): Promise<FastifyReply> {
  if (req.locals.user?.username !== req.params?.username && req.locals.user?.role !== 'admin' && req.locals.user?.role !== 'master') {
    return reply.code(403).send({
      statusCode: 403,
      message: 'Forbidden',
    });
  }

  return {} as FastifyReply;
}

export async function sameUserCantDoThisAction(req: FastifyRequest<AuthLoginRequest & AuthParamsRequest>, reply: FastifyReply): Promise<FastifyReply> {
  if (req.params.username === req.locals.user?.username) {
    return reply.code(403).send({
      statusCode: 403,
      message: 'Forbidden',
    });
  }

  return {} as FastifyReply;
}

export async function onlySessionCanDoThisAction(req: FastifyRequest<AuthLoginRequest>, reply: FastifyReply): Promise<FastifyReply> {
  if (req.locals.authKind !== 'session') {
    return reply.code(403).send({
      statusCode: 403,
      message: 'This action requires a logged-in session',
    });
  }

  return {} as FastifyReply;
}
