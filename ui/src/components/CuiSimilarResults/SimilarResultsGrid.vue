<template>
  <div v-if="scaled" class="px-3 pb-3 shrink-0">
    <Slider v-model="breadth" :min="0" :max="100" :aria-label="t('components.similar.more_broad')" />
    <div class="flex justify-between mt-2 text-xs text-muted">
      <span>{{ t('components.similar.more_precise') }}</span>
      <span>{{ t('components.similar.more_broad') }}</span>
    </div>
  </div>

  <CuiRecordingsGrid v-if="items.length" :items :min-item-width="180" :gap="8" :item-key="itemKey" class="flex-1 min-h-0 px-3">
    <template #item="{ item }">
      <div class="relative">
        <RecordingCard
          :event="item.event"
          :camera-name="cameraById.get(item.event.cameraId)?.name"
          :camera="cameraById.get(item.event.cameraId)"
          :semantic-score="item.score"
          :seg-index="item.segIndex"
          @scroll-to-event="(ts: number) => emit('open', { event: item.event, camera: cameraById.get(item.event.cameraId), timestamp: ts }, item)"
          @open-trace="(atMs?: number) => openTrace(item.event, atMs)"
        />
        <slot name="badge" :item />
      </div>
    </template>
  </CuiRecordingsGrid>

  <div v-else class="flex-1 min-h-0 flex items-center justify-center p-4 text-sm text-muted text-center">
    <i-svg-spinners:ring-resize v-if="searching" class="w-6 h-6" />
    <span v-else-if="searched">{{ t('views.recordings.similar_empty') }}</span>
  </div>
</template>

<script setup lang="ts" generic="T extends SimilarResultItem">
import { CamerasQuery } from '@/api/routes/cameras.js';

import type { RecordedEvent } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';
import type { SimilarResultItem, SimilarResultsGridEmits, SimilarResultsGridProps } from './types.js';

const camerasQuery = new CamerasQuery();

defineProps<SimilarResultsGridProps<T>>();

const emit = defineEmits<SimilarResultsGridEmits<T>>();

const breadth = defineModel<number>('breadth', { required: true });

const { t } = useI18n();
const { openEventTrace } = useEventTraceDialog();

const { data: camerasData } = camerasQuery.getCamerasQuery({ page: 1, pageSize: -1 });

const cameraById = computed(() => new Map<string, DBCamera>((camerasData.value?.result ?? []).map((camera) => [camera._id, camera])));

function itemKey(item: T): string {
  return item.key;
}

function openTrace(event: RecordedEvent, atMs?: number): void {
  const camera = cameraById.value.get(event.cameraId);
  if (camera) openEventTrace(event, camera, atMs);
}
</script>
