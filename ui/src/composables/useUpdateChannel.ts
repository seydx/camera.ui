import { ConfigQuery } from '@/api/routes/config.js';
import { CLOUD_SERVICE_URL } from '@/common/constants.js';
import { isCapacitor } from '@/connection/index.js';

import type { IConfig } from '@shared/types';

const BASE_URL = `${CLOUD_SERVICE_URL}/api/updates/latest`;

async function applyNativeUrl(beta: boolean): Promise<void> {
  if (!isCapacitor) return;

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.setUpdateUrl({ url: beta ? `${BASE_URL}?channel=beta` : BASE_URL });
  } catch {
    // plugin not ready, the next config change retries
  }
}

export function useUpdateChannel() {
  const configQuery = new ConfigQuery();
  const { data: config } = configQuery.getConfigQuery(true);
  const { mutateAsync: patchConfig } = configQuery.patchConfigQuery();

  const current = computed<IConfig | undefined>(() => (config.value && typeof config.value !== 'string' ? (config.value as IConfig) : undefined));
  const isBeta = computed(() => current.value?.betaUpdates ?? false);

  watch(
    () => current.value?.betaUpdates,
    (beta) => {
      if (beta === undefined) return;
      applyNativeUrl(beta);
    },
    { immediate: true },
  );

  const setBeta = async (next: boolean): Promise<void> => {
    const config = current.value;
    if (!config || config.betaUpdates === next) return;

    await patchConfig({ configData: JSON.stringify({ ...config, betaUpdates: next }) });
  };

  return {
    isBeta,
    setBeta,
  };
}
