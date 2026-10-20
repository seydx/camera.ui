import { axiosInstance as api } from '..';

import type { DBFloorPlan, PutFloorPlanInput } from '@shared/types';
import type { AxiosResponse } from 'axios';

export async function getFloorPlan({ signal }: { signal?: AbortSignal } = {}): Promise<DBFloorPlan> {
  const response: AxiosResponse<DBFloorPlan> = await api.get('/floorplan', { signal });
  return response.data;
}

export async function putFloorPlan(plan: PutFloorPlanInput, version?: number): Promise<DBFloorPlan> {
  const response: AxiosResponse<DBFloorPlan> = await api.put('/floorplan', plan, { params: { version } });
  return response.data;
}
