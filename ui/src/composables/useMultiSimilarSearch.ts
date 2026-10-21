import { useNvrDataEpoch } from '@camera.ui/nvr';

import { mergeSimilarItems, similarItems } from '@/components/CuiSimilarResults/utils.js';

import type { SimilarPick, SimilarPickItem } from '@/components/CuiMultiSimilarResults/types.js';
import type { SimilarSearchRequest } from '@/components/CuiSimilarPicker/types.js';
import type { NVRInterface } from '@camera.ui/nvr';
import type { Promisify } from '@camera.ui/rpc';
import type { DBCamera } from '@shared/types';

export function useMultiSimilarSearch() {
  const log = useLogger('MultiSimilarSearch');
  const { plugin } = usePlugin('@camera.ui/camera-ui-nvr');

  const picks = shallowRef<SimilarPick[]>([]);
  const licenseRequired = shallowRef(false);
  const breadth = ref(100);
  const runs = new Map<number, number>();
  let nextId = 0;

  const items = computed<SimilarPickItem[]>(() =>
    mergeSimilarItems(picks.value.map((pick) => similarItems(pick.result, breadth.value).map((item) => ({ ...item, pick })))),
  );

  function add(camera: DBCamera, request: SimilarSearchRequest): void {
    const pick: SimilarPick = { id: ++nextId, camera, request, searching: true };
    picks.value = [...picks.value, pick];
    search(pick);
  }

  function remove(id: number): void {
    runs.delete(id);
    picks.value = picks.value.filter((pick) => pick.id !== id);
  }

  function clear(): void {
    runs.clear();
    picks.value = [];
    breadth.value = 100;
    licenseRequired.value = false;
  }

  function update(id: number, changes: Pick<SimilarPick, 'result' | 'searching'>): void {
    picks.value = picks.value.map((pick) => (pick.id === id ? { ...pick, ...changes } : pick));
  }

  async function search(pick: SimilarPick): Promise<void> {
    const nvr = plugin.value as unknown as Promisify<NVRInterface> | undefined;
    if (!nvr) return;
    const run = (runs.get(pick.id) ?? 0) + 1;
    runs.set(pick.id, run);
    try {
      const result = await nvr.searchSimilarQuery(pick.request.query, {});
      if (runs.get(pick.id) !== run) return;
      update(pick.id, { result, searching: false });
      licenseRequired.value = false;
    } catch (err) {
      if (runs.get(pick.id) !== run) return;
      update(pick.id, { result: undefined, searching: false });
      if (String((err as Error)?.message ?? err).includes('license verification required')) licenseRequired.value = true;
      else log.error('Similar search failed:', err);
    }
  }

  watch(
    () => Boolean(plugin.value),
    (available) => {
      if (!available) return;
      for (const pick of picks.value) if (pick.searching) search(pick);
    },
  );

  // another plugin instance holds other events
  watch(useNvrDataEpoch(), () => {
    picks.value = picks.value.map((pick) => ({ ...pick, result: undefined, searching: true }));
    for (const pick of picks.value) search(pick);
  });

  return { picks, items, breadth, licenseRequired, add, remove, clear };
}
