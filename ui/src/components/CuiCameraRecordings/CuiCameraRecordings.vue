<template>
  <div class="flex flex-col h-full">
    <CuiCameraRecordingsToolbar
      v-model:search="search"
      v-model:selected-types="selectedTypes"
      v-model:selected-date="selectedDate"
      v-model:min-confidence="minConfidence"
      :compact
    />

    <div class="flex-1 min-h-0 flex flex-col mt-3">
      <CuiRecordingsGrid
        v-if="displayItems.length"
        :items="displayItems"
        :min-item-width="150"
        :gap="8"
        :has-more="hasMore"
        :load-more="loadMore"
        :item-key="itemKey"
        class="flex-1 min-h-0"
      >
        <template #item="{ item }">
          <RecordingCard
            :event="item.event"
            :seg-index="item.segIndex"
            hide-segment-badge
            :camera-name="cameraName"
            :camera="camera"
            @scroll-to-event="(ts: number) => emit('scrollToEvent', ts)"
            @open-trace="(atMs?: number) => openTrace(item.event, atMs)"
          />
        </template>
      </CuiRecordingsGrid>

      <div v-if="isLoading && !displayItems.length" class="flex justify-center py-4">
        <i-svg-spinners:ring-resize width="24px" height="24px" class="text-muted" />
      </div>

      <div v-if="!displayEvents.length && !isLoading" class="flex flex-col items-center justify-center py-10 gap-3">
        <i-tabler:video-off class="w-12 h-12 text-muted opacity-30" />
        <p class="text-muted text-sm">{{ eventsUnavailable ? $t('views.recordings.recordings_unavailable') : $t('views.recordings.no_recordings') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDetectionEvents } from '@camera.ui/nvr';
import { DETECTION_ATTRIBUTES } from '@camera.ui/sdk';

import { GridSearchKey } from '@/components/CuiGridSearch/types.js';
import { boxOverlapsRegions } from '@/components/CuiGridSearch/utils.js';
import CuiRecordingsGrid from '@/components/CuiRecordings/CuiRecordingsGrid.vue';
import { buildUngroupedItems } from '@/components/CuiRecordings/ungrouped.js';
import { provideEventHoverPreview } from '@/composables/provideEventHoverPreview.js';
import CuiCameraRecordingsToolbar from './CuiCameraRecordingsToolbar.vue';

import type { UngroupedItem } from '@/components/CuiRecordings/ungrouped.js';
import type { GetEventsOptions, RecordedEvent } from '@camera.ui/nvr';
import type { CuiCameraRecordingsEmits, CuiCameraRecordingsProps } from './types.js';

const props = withDefaults(defineProps<CuiCameraRecordingsProps>(), { compact: false });

const emit = defineEmits<CuiCameraRecordingsEmits>();

const { openEventTrace } = useEventTraceDialog();

const gridSearch = inject(GridSearchKey, undefined);

provideEventHoverPreview(10);

const ATTR_SET = new Set<string>(DETECTION_ATTRIBUTES);
const REGION_FILL_ITEMS = 12;
const REGION_FILL_PAGES = 5;

const search = ref('');
const selectedTypes = ref<string[]>([]);
const selectedTriggers = ref<string[]>([]);
const selectedDate = ref<Date | undefined>();
const minConfidence = ref(0);

const searchQuery = refDebounced(search, 300);
const confidence = refDebounced(minConfidence, 300);

let regionFillPages = 0;

const cameraIds = computed(() => [props.cameraId]);

const serverFilter = computed<GetEventsOptions>(() => {
  const attrFilters = selectedTypes.value.filter((t) => ATTR_SET.has(t));
  const hasAnyFilter = selectedTypes.value.length > 0 || selectedTriggers.value.length > 0;
  const day = selectedDate.value;
  return {
    types: selectedTypes.value.length > 0 ? selectedTypes.value.filter((t) => !ATTR_SET.has(t)) : undefined,
    triggers: selectedTriggers.value.length > 0 ? selectedTriggers.value : undefined,
    attributes: attrFilters.length > 0 ? attrFilters : undefined,
    search: searchQuery.value.trim() || undefined,
    minConfidence: confidence.value > 0 ? confidence.value : undefined,
    hasDetections: !hasAnyFilter,
    startMs: day ? new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() : undefined,
    endMs: day ? new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime() - 1 : undefined,
  };
});

const {
  events,
  isLoading,
  hasMore,
  loadMore,
  pluginUnavailable: eventsUnavailable,
} = useDetectionEvents({
  availableCameraIds: cameraIds,
  cameraIds,
  realtime: true,
  pageSize: 30,
  filter: serverFilter,
});

const displayEvents = computed(() => {
  let result = events.value.filter((e) => e.state === 'ended' || (e.segments?.length ?? 0) > 0);

  const regions = gridSearch?.regions.value;
  if (regions && regions.length > 0) {
    result = result.filter((e) => e.segments.some((s) => s.detections.some((d) => d.box && boxOverlapsRegions(d.box, regions))));
  }

  return result;
});

const displayItems = computed(() => buildUngroupedItems(displayEvents.value));

const regionsKey = computed(() => JSON.stringify(gridSearch?.regions.value ?? []));

function itemKey(item: UngroupedItem): string {
  return item.key;
}

function openTrace(event: RecordedEvent, atMs?: number): void {
  if (props.camera) openEventTrace(event, props.camera, atMs);
}

watch([regionsKey, serverFilter], () => {
  regionFillPages = 0;
});

watch([() => displayItems.value.length, hasMore, isLoading, regionsKey], ([count, more, loading]) => {
  if (!gridSearch?.regions.value.length || !more || loading) return;
  if (count >= REGION_FILL_ITEMS || regionFillPages >= REGION_FILL_PAGES) return;
  regionFillPages++;
  loadMore();
});
</script>
