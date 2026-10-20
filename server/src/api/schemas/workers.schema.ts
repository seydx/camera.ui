import * as zod from 'zod';

import { SUBJECT_TOKEN } from '../../rpc/namespaces.js';

export const assignCameraSchema = zod.object({
  cameraId: zod.string().min(1, 'Camera ID is required'),
  agentId: zod.string().min(1, 'Agent ID is required'),
  workerOnly: zod.boolean().optional(),
});

export const unassignCameraSchema = zod.object({
  cameraId: zod.string().min(1, 'Camera ID is required'),
});

export const agentParamsSchema = zod.object({
  agentId: zod.string().min(1, 'Agent ID is required'),
});

export const updateWorkerSchema = zod
  .object({
    version: zod.string().min(1).optional(),
  })
  .optional();

export const createPairingSchema = zod
  .object({
    replaces: zod.string().regex(SUBJECT_TOKEN, 'Agent ID may only contain letters, digits, _ and -').optional(),
  })
  .optional();

export const pairWorkerSchema = zod.object({
  code: zod.string().min(1, 'Pairing code is required'),
  agentId: zod.string().regex(SUBJECT_TOKEN, 'Agent ID may only contain letters, digits, _ and -'),
  name: zod.string().min(1, 'Worker name is required'),
});

export const assignPluginSchema = zod.object({
  pluginName: zod.string().min(1, 'Plugin name is required'),
  agentId: zod.string().min(1, 'Agent ID is required'),
  workerOnly: zod.boolean().optional(),
});

export const unassignPluginSchema = zod.object({
  pluginName: zod.string().min(1, 'Plugin name is required'),
});

export const patchWorkerSchema = zod
  .object({
    name: zod.string().trim().min(1, 'Name is required').max(64, 'Maximum 64 characters').optional(),
    serverAddresses: zod.union([zod.ipv4().trim(), zod.ipv6().trim()]).array().optional(),
  })
  .strict();

export const patchWorkersConfigSchema = zod
  .object({
    enabled: zod.boolean().optional(),
    address: zod.string().trim().optional(),
    port: zod.number().min(1024, 'Minimum 1024').max(65535, 'Maximum 65535').optional(),
  })
  .strict();

export type AssignCameraInput = zod.output<typeof assignCameraSchema>;
export type UnassignCameraInput = zod.output<typeof unassignCameraSchema>;
export type AgentParamsInput = zod.output<typeof agentParamsSchema>;
export type PairWorkerInput = zod.output<typeof pairWorkerSchema>;
export type PatchWorkerInput = zod.output<typeof patchWorkerSchema>;
export type PatchWorkersConfigInput = zod.output<typeof patchWorkersConfigSchema>;
