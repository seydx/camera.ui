import { axiosInstance as api } from '..';

import type {
  CamerasResponse,
  CrossHostFrameLink,
  PatchWorkerInput,
  PatchWorkersConfigInput,
  WorkerInfo,
  WorkerPairingResponse,
  WorkersConfigResponse,
} from '@shared/types';
import type { AxiosResponse } from 'axios';

export async function getWorkers(): Promise<WorkerInfo[]> {
  const response: AxiosResponse<WorkerInfo[]> = await api.get('/workers');
  return response.data;
}

export async function getCrossHostFrameLinks(): Promise<CrossHostFrameLink[]> {
  const response: AxiosResponse<CrossHostFrameLink[]> = await api.get('/workers/frame-links');
  return response.data;
}

export async function getWorkersConfig(): Promise<WorkersConfigResponse> {
  const response: AxiosResponse<WorkersConfigResponse> = await api.get('/workers/config');
  return response.data;
}

export async function patchWorkersConfig(patch: PatchWorkersConfigInput): Promise<PatchWorkersConfigInput> {
  const response: AxiosResponse<PatchWorkersConfigInput> = await api.patch('/workers/config', patch);
  return response.data;
}

export async function createWorkerPairing(replaces?: string): Promise<WorkerPairingResponse> {
  const response: AxiosResponse<WorkerPairingResponse> = await api.post('/workers/pairings', replaces ? { replaces } : {});
  return response.data;
}

export async function removeWorker(agentId: string): Promise<void> {
  await api.delete(`/workers/${agentId}`);
}

export async function restartWorker(agentId: string): Promise<void> {
  await api.post(`/workers/${agentId}/restart`);
}

export async function updateWorker({ agentId, version }: { agentId: string; version?: string }): Promise<void> {
  await api.post(`/workers/${agentId}/update`, version ? { version } : {});
}

export async function patchWorker({ agentId, ...patch }: PatchWorkerInput & { agentId: string }): Promise<void> {
  await api.patch(`/workers/${agentId}`, patch);
}

export async function assignCameraToWorker({ cameraId, agentId, workerOnly }: { cameraId: string; agentId: string; workerOnly?: boolean }): Promise<boolean> {
  const response = await api.post('/workers/assign', { cameraId, agentId, workerOnly });
  return response.status === 202;
}

export async function unassignCameraFromWorker({ cameraId }: { cameraId: string }): Promise<boolean> {
  const response = await api.post('/workers/unassign', { cameraId });
  return response.status === 202;
}

export async function assignPluginToWorker({ pluginName, agentId, workerOnly }: { pluginName: string; agentId: string; workerOnly?: boolean }): Promise<boolean> {
  const response = await api.post('/workers/assign-plugin', { pluginName, agentId, workerOnly });
  return response.status === 202;
}

export async function unassignPluginFromWorker({ pluginName }: { pluginName: string }): Promise<boolean> {
  const response = await api.post('/workers/unassign-plugin', { pluginName });
  return response.status === 202;
}

export class WorkersQuery {
  private _queryClient = useQueryClient();
  private toast = useCuiToast();

  public getConfigQuery() {
    return useQueryEnhanced({
      queryKey: ['workersConfig'],
      queryFn: () => getWorkersConfig(),
      refetchInterval: 15_000,
      retry: false,
    });
  }

  public getFrameLinksQuery(enabled: () => boolean) {
    return useQueryEnhanced({
      queryKey: ['workersFrameLinks'],
      queryFn: () => getCrossHostFrameLinks(),
      enabled,
      refetchInterval: 10_000,
      retry: false,
    });
  }

  public patchConfigQuery() {
    return useMutation({
      mutationFn: patchWorkersConfig,
      onSuccess: () => this._queryClient.invalidateQueries({ queryKey: ['workersConfig'] }),
      onError: (error) => {
        this.toast.add({ severity: 'error', detail: error, life: 3000 });
      },
    });
  }

  public createPairingQuery() {
    return useMutation({
      mutationFn: createWorkerPairing,
      onError: (error) => {
        this.toast.add({ severity: 'error', detail: error, life: 5000 });
      },
    });
  }

  public removeWorkerQuery() {
    return useMutation({
      mutationFn: removeWorker,
      onError: (error) => {
        this.toast.add({ severity: 'error', detail: error, life: 3000 });
      },
      onSettled: () => this._queryClient.invalidateQueries({ queryKey: ['camerasList'] }),
    });
  }

  public assignCameraQuery() {
    return useMutation({
      mutationFn: assignCameraToWorker,
      onMutate: ({ cameraId, agentId, workerOnly }) => this.patchCameraWorker(cameraId, agentId, workerOnly),
      onError: (error, _variables, context) => {
        context?.rollback();
        this.toast.add({ severity: 'error', detail: error, life: 3000 });
      },
      onSettled: () => this.invalidateAssignments('camerasList'),
    });
  }

  public unassignCameraQuery() {
    return useMutation({
      mutationFn: unassignCameraFromWorker,
      onMutate: ({ cameraId }) => this.patchCameraWorker(cameraId, undefined),
      onError: (error, _variables, context) => {
        context?.rollback();
        this.toast.add({ severity: 'error', detail: error, life: 3000 });
      },
      onSettled: () => this.invalidateAssignments('camerasList'),
    });
  }

  public restartWorkerQuery() {
    return useMutation({
      mutationFn: restartWorker,
      onError: (error) => {
        this.toast.add({ severity: 'error', detail: error, life: 5000 });
      },
    });
  }

  public updateWorkerQuery() {
    return useMutation({
      mutationFn: updateWorker,
      onError: (error) => {
        this.toast.add({ severity: 'error', detail: error, life: 5000 });
      },
    });
  }

  public patchWorkerQuery() {
    return useMutation({
      mutationFn: patchWorker,
      onError: (error) => {
        this.toast.add({ severity: 'error', detail: error, life: 3000 });
      },
    });
  }

  public assignPluginQuery() {
    return useMutation({
      mutationFn: assignPluginToWorker,
      onError: (error) => {
        this.toast.add({ severity: 'error', detail: error, life: 3000 });
      },
      onSettled: () => this.invalidateAssignments('pluginsList'),
    });
  }

  public unassignPluginQuery() {
    return useMutation({
      mutationFn: unassignPluginFromWorker,
      onError: (error) => {
        this.toast.add({ severity: 'error', detail: error, life: 3000 });
      },
      onSettled: () => this.invalidateAssignments('pluginsList'),
    });
  }

  private invalidateAssignments(listKey: 'camerasList' | 'pluginsList') {
    return Promise.all([this._queryClient.invalidateQueries({ queryKey: [listKey] }), this._queryClient.invalidateQueries({ queryKey: ['workersFrameLinks'] })]);
  }

  private patchCameraWorker(cameraId: string, agentId: string | undefined, workerOnly?: boolean): { rollback: () => void } {
    const snapshots: [readonly unknown[], CamerasResponse | undefined][] = [];
    for (const [key, data] of this._queryClient.getQueriesData<CamerasResponse>({ queryKey: ['camerasList'] })) {
      if (!data?.result) continue;
      snapshots.push([key, data]);
      this._queryClient.setQueryData<CamerasResponse>(key, {
        ...data,
        result: data.result.map((cam) =>
          cam._id === cameraId ? { ...cam, workerAgentId: agentId, workerOnly: agentId && (workerOnly ?? cam.workerOnly) ? true : undefined } : cam,
        ),
      });
    }
    return {
      rollback: () => {
        for (const [key, data] of snapshots) this._queryClient.setQueryData(key, data);
      },
    };
  }
}
