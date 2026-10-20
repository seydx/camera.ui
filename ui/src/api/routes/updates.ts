import { axiosInstance as api } from '..';

import type { UpdatesLeftBehindWorker, UpdatesRunState, UpdatesStatus } from '@shared/types';
import type { AxiosResponse } from 'axios';

export interface WorkersLeftBehind {
  workers: UpdatesLeftBehindWorker[];
  target: { version: string; protocolKnown: boolean };
}

export async function getUpdatesStatus({ signal }: { signal?: AbortSignal } = {}): Promise<UpdatesStatus> {
  const response: AxiosResponse<UpdatesStatus> = await api.get('/updates/status', { signal });
  return response.data;
}

export async function runUpdates({ confirmWorkers }: { confirmWorkers?: boolean } = {}): Promise<UpdatesRunState> {
  const response: AxiosResponse<UpdatesRunState> = await api.post('/updates/run', confirmWorkers ? { confirmWorkers } : undefined);
  return response.data;
}

export function workersLeftBehind(error: any): WorkersLeftBehind | undefined {
  const data = error?.response?.status === 409 ? error.response.data : undefined;
  return Array.isArray(data?.workers) && data.workers.length > 0 && data.target ? { workers: data.workers, target: data.target } : undefined;
}

export async function cancelUpdates(): Promise<void> {
  await api.post('/updates/cancel');
}

export async function checkUpdates(): Promise<void> {
  await api.post('/updates/check', undefined, { timeout: 60_000 });
}
