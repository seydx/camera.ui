<template>
  <div v-if="scaled && layout === 'grid'" class="px-3 pb-3 shrink-0">
    <Slider v-model="breadth" :min="0" :max="100" :aria-label="t('components.similar.more_broad')" />
    <div class="flex justify-between mt-2 text-xs text-muted">
      <span>{{ t('components.similar.more_precise') }}</span>
      <span>{{ t('components.similar.more_broad') }}</span>
    </div>
  </div>

  <div v-if="items.length" ref="listRef" class="flex-1 min-h-0 min-w-0" :class="layout === 'strip' ? 'similar-strip' : 'px-3'" @wheel="onWheel">
    <component :is="layout === 'strip' ? CuiVirtualScroller : CuiRecordingsGrid" v-if="layout === 'grid' || cardSize" v-bind="listProps" class="h-full">
      <template #item="{ item }: { item: T }">
        <div class="relative similar-cell">
          <RecordingCard
            :event="item.event"
            :camera-name="cameraById.get(item.event.cameraId)?.name"
            :camera="cameraById.get(item.event.cameraId)"
            :semantic-score="item.score"
            :seg-index="item.segIndex"
            :sibling-active="item.key === activeKey"
            @scroll-to-event="(ts: number) => emit('open', { event: item.event, camera: cameraById.get(item.event.cameraId), timestamp: ts }, item)"
            @open-trace="(atMs?: number) => openTrace(item.event, atMs)"
          />
          <slot name="badge" :item />
        </div>
      </template>
    </component>
  </div>

  <div v-else class="flex-1 min-h-0 flex items-center justify-center p-4 text-sm text-muted text-center">
    <i-svg-spinners:ring-resize v-if="searching" class="w-6 h-6" />
    <span v-else-if="searched">{{ t('views.recordings.similar_empty') }}</span>
  </div>
</template>

<script setup lang="ts" generic="T extends SimilarResultItem">
import { EventHoverPreviewKey } from '@camera.ui/nvr';

import { CamerasQuery } from '@/api/routes/cameras.js';
import CuiRecordingsGrid from '@/components/CuiRecordings/CuiRecordingsGrid.vue';
import CuiVirtualScroller from '@/components/CuiVirtualScroller/CuiVirtualScroller.vue';
import { provideEventHoverPreview } from '@/composables/provideEventHoverPreview.js';
import { SIMILAR_CARD_GAP } from './types.js';

import type { RecordedEvent } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';
import type { SimilarResultItem, SimilarResultsGridEmits, SimilarResultsGridProps } from './types.js';

const camerasQuery = new CamerasQuery();

const props = withDefaults(defineProps<SimilarResultsGridProps<T>>(), { layout: 'grid', activeKey: undefined });

const emit = defineEmits<SimilarResultsGridEmits<T>>();

const breadth = defineModel<number>('breadth', { required: true });

const { t } = useI18n();
const { openEventTrace } = useEventTraceDialog();

// in the timeline and in dialogs no list around the results provides one
if (!inject(EventHoverPreviewKey, undefined)) provideEventHoverPreview(10);

const { data: camerasData } = camerasQuery.getCamerasQuery({ page: 1, pageSize: -1 });

const listRef = useTemplateRef<HTMLElement>('listRef');
const cardSize = ref(0);

const cameraById = computed(() => new Map<string, DBCamera>((camerasData.value?.result ?? []).map((camera) => [camera._id, camera])));

const listProps = computed(() =>
  props.layout === 'strip'
    ? {
        items: props.items,
        itemSize: cardSize.value + SIMILAR_CARD_GAP,
        orientation: 'horizontal',
        scrollHeight: '100%',
        itemKey,
        style: { '--similar-card': `${cardSize.value}px`, '--similar-gap': `${SIMILAR_CARD_GAP}px` },
      }
    : { items: props.items, minItemWidth: 180, gap: SIMILAR_CARD_GAP, itemKey },
);

function itemKey(item: T): string {
  return item.key;
}

// a mouse wheel scrolls vertically, the strip runs sideways
function onWheel(event: WheelEvent): void {
  const scroller = listRef.value?.firstElementChild;
  if (props.layout !== 'strip' || !scroller || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  scroller.scrollLeft += event.deltaY;
}

function openTrace(event: RecordedEvent, atMs?: number): void {
  const camera = cameraById.value.get(event.cameraId);
  if (camera) openEventTrace(event, camera, atMs);
}

useResizeObserver(listRef, ([entry]) => {
  const size = Math.floor(entry.contentRect.height);
  if (props.layout === 'strip' && size > 0 && size !== cardSize.value) cardSize.value = size;
});
</script>

<style scoped>
.similar-strip :deep(.p-virtualscroller-content) {
  padding-left: var(--similar-gap);
}

.similar-strip :deep(.similar-cell) {
  width: var(--similar-card);
  height: var(--similar-card);
  margin-right: var(--similar-gap);
}
</style>
