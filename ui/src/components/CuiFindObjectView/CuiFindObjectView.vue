<template>
  <div v-if="find" class="h-full min-h-0" :class="ROOT_CLASS[layout]">
    <div
      v-if="!picks.length && layout !== 'bar'"
      class="flex flex-1 min-h-0 flex-col items-center justify-center px-6 text-center text-muted"
      :class="layout === 'strip' ? 'gap-2 text-xs' : 'gap-4 text-sm'"
    >
      <template v-if="find.pickable.value">
        <i-tabler:zoom-scan :class="layout === 'strip' ? 'w-8 h-8' : 'w-12 h-12'" />
        <span>{{ t('components.similar.find_hint') }}</span>
      </template>
    </div>

    <template v-else-if="layout === 'grid'">
      <div class="find-bar mx-3">
        <div class="flex items-start gap-2">
          <div class="flex flex-wrap gap-1.5 min-w-0 flex-1 py-1">
            <span v-for="pick in picks" :key="pick.id" class="find-chip">
              <img v-if="pick.request.crop" :src="pick.request.crop" alt="" class="find-chip-crop" />
              <span class="truncate">{{ pickLabel(pick) }}</span>
              <button type="button" class="find-chip-remove" :aria-label="t('components.similar.remove_pick')" @click="find.remove(pick.id)">
                <i-tabler:x class="w-3 h-3" />
              </button>
            </span>
          </div>

          <i-svg-spinners:ring-resize v-if="searching" class="w-4 h-4 shrink-0 self-center text-muted" />

          <Button
            v-tooltip.bottom="{ value: t('views.recordings.similar_clear') }"
            severity="secondary"
            text
            rounded
            class="shrink-0"
            :aria-label="t('views.recordings.similar_clear')"
            @click="find.endSearch()"
          >
            <template #icon>
              <i-tabler:x class="w-4 h-4" />
            </template>
          </Button>
        </div>

        <span v-if="subtitle" class="block mt-1 text-xs text-muted truncate">{{ subtitle }}</span>
      </div>

      <SimilarResultsGrid v-model:breadth="breadth" :items :scaled :searching :searched :active-key="openedKey" @open="open">
        <template #badge="{ item }">
          <img v-if="picks.length > 1 && item.pick.request.crop" :src="item.pick.request.crop" alt="" class="find-badge" />
        </template>
      </SimilarResultsGrid>

      <div class="p-3 shrink-0">
        <Button :label="t('components.similar.show_all')" severity="secondary" size="small" class="w-full" @click="showAll" />
      </div>
    </template>

    <div v-else-if="layout === 'bar' && picks.length" class="find-bar-pill shadow-md">
      <span v-for="pick in picks" :key="pick.id" class="find-bar-pick">
        <img v-if="pick.request.crop" :src="pick.request.crop" alt="" class="w-full h-full object-cover rounded-full" />
        <i-tabler:zoom-scan v-else class="w-4 h-4" />
        <button type="button" class="find-bar-pick-remove" :aria-label="t('components.similar.remove_pick')" @click="find.remove(pick.id)">
          <i-tabler:x class="w-2.5 h-2.5" />
        </button>
      </span>
      <i-svg-spinners:ring-resize v-if="searching" class="w-4 h-4 shrink-0" />
      <span v-if="subtitle" class="find-bar-count text-xs truncate min-w-0">{{ subtitle }}</span>

      <div class="flex items-center gap-3 ml-auto shrink-0">
        <Slider v-if="scaled" v-model="breadth" :min="0" :max="100" :aria-label="t('components.similar.more_broad')" class="find-bar-breadth" />
        <button type="button" class="find-bar-all" @click="showAll">
          {{ t('components.similar.show_all') }}
        </button>
        <button
          v-tooltip.bottom="{ value: t('views.recordings.similar_clear') }"
          type="button"
          class="find-bar-end"
          :aria-label="t('views.recordings.similar_clear')"
          @click="find.endSearch()"
        >
          <i-tabler:x class="w-4 h-4" />
        </button>
      </div>
    </div>

    <SimilarResultsGrid v-else-if="layout === 'strip'" v-model:breadth="breadth" layout="strip" :items :scaled :searching :searched :active-key="openedKey" @open="open">
      <template #badge="{ item }">
        <img v-if="picks.length > 1 && item.pick.request.crop" :src="item.pick.request.crop" alt="" class="find-badge" />
      </template>
    </SimilarResultsGrid>
  </div>
</template>

<script setup lang="ts">
import { hasScoreRange } from '@/components/CuiSimilarResults/utils.js';
import { FindObjectKey } from './types.js';
import { pickLabel } from './utils.js';

import type { SimilarResultOpen } from '@/components/CuiSimilarResults/types.js';
import type { TimelineFindLayout } from '@camera.ui/nvr';
import type { CuiFindObjectViewEmits, CuiFindObjectViewProps, FindItem } from './types.js';

defineProps<CuiFindObjectViewProps>();

const ROOT_CLASS: Record<TimelineFindLayout, string> = {
  grid: 'flex flex-col pt-2',
  strip: 'flex flex-row pb-2',
  bar: 'find-bar-row flex items-center w-full',
};

const emit = defineEmits<CuiFindObjectViewEmits>();

const { t } = useI18n();

const find = inject(FindObjectKey, undefined);

const picks = computed(() => find?.picks.value ?? []);
const items = computed(() => find?.items.value ?? []);
const openedKey = computed(() => find?.openedKey.value);
const breadth = computed({
  get: () => find?.breadth.value ?? 100,
  set: (value: number) => {
    if (find) find.breadth.value = value;
  },
});
const searching = computed(() => picks.value.some((pick) => pick.searching));
const searched = computed(() => picks.value.some((pick) => pick.result));
const scaled = computed(() => picks.value.some((pick) => hasScoreRange(pick.result)));
const subtitle = computed(() => {
  if (find?.licenseRequired.value) return t('views.recordings.similar_license');
  if (!searched.value) return '';
  const count = t('views.recordings.similar_count', items.value.length);
  const kinds = new Set(items.value.map((item) => item.kind));
  if (kinds.size > 1) return `${count} · ${t('views.recordings.similar_surest_first')}`;
  return kinds.has('person') || kinds.has('appearance') ? `${count} · ${t('views.recordings.similar_best_first')}` : count;
});

function showAll(): void {
  emit(
    'showAll',
    picks.value.map((pick) => pick.request),
  );
}

function open(match: SimilarResultOpen, item: FindItem): void {
  if (find) find.openedKey.value = item.key;
  emit('open', match, item.pick);
}
</script>

<style scoped>
.find-bar {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background: var(--card-background);
}

.find-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 28px;
  padding: 0 4px 0 2px;
  border-radius: 999px;
  background: var(--p-chip-background, rgb(128 128 128 / 0.15));
  color: var(--p-chip-color, inherit);
  font-size: 12px;
}

.find-chip-crop {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 999px;
  object-fit: cover;
  background: rgb(0 0 0 / 0.3);
}

.find-chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  cursor: pointer;
  opacity: 0.7;
}

.find-chip-remove:hover {
  opacity: 1;
  background: rgb(128 128 128 / 0.2);
}

.find-badge {
  position: absolute;
  top: 3rem;
  left: 0.5rem;
  z-index: 4;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  object-fit: cover;
  background: rgb(0 0 0 / 0.6);
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.7);
  pointer-events: none;
}

.find-bar-row {
  container-type: inline-size;
}

.find-bar-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  height: 35px;
  padding: 0 4px;
  border-radius: 9999px;
  background: var(--p-button-secondary-background);
  color: var(--p-button-secondary-color);
}

.find-bar-breadth {
  width: 5rem;
  flex-shrink: 0;
}

.find-bar-all {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--p-primary-color);
  cursor: pointer;
}

.find-bar-end {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  border-radius: 9999px;
  opacity: 0.75;
  cursor: pointer;
}

.find-bar-end:hover {
  opacity: 1;
}

@container (max-width: 420px) {
  .find-bar-count {
    display: none;
  }
}

@container (max-width: 320px) {
  .find-bar-breadth {
    display: none;
  }
}

.find-bar-pick {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.3);
}

.find-bar-pick-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.75);
  color: #fff;
  cursor: pointer;
}
</style>
