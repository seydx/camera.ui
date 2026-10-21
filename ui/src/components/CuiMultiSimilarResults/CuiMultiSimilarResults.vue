<template>
  <div class="multi-similar-results">
    <div class="multi-similar-bar mx-3">
      <div class="flex items-start gap-2">
        <div v-if="picks.length" class="flex flex-wrap gap-1.5 min-w-0 flex-1 py-1">
          <Chip
            v-for="pick in picks"
            :key="pick.id"
            :image="pick.request.crop"
            :label="pickLabel(pick)"
            removable
            class="text-xs max-w-full"
            :pt="CHIP_PT"
            @remove="emit('remove', pick.id)"
          />
        </div>
        <div v-else class="flex items-center gap-2 min-w-0 flex-1 min-h-10">
          <i-tabler:zoom-scan class="w-5 h-5 shrink-0 text-muted" />
          <span class="text-sm font-semibold truncate">{{ t('components.similar.pick_hint') }}</span>
        </div>

        <i-svg-spinners:ring-resize v-if="searching" class="w-4 h-4 shrink-0 self-center text-muted" />

        <Button
          v-tooltip.bottom="{ value: t('views.recordings.similar_clear') }"
          severity="secondary"
          text
          rounded
          class="shrink-0"
          :aria-label="t('views.recordings.similar_clear')"
          @click="emit('close')"
        >
          <template #icon>
            <i-tabler:x class="w-4 h-4" />
          </template>
        </Button>
      </div>

      <span v-if="subtitle" class="block mt-1 text-xs text-muted truncate">{{ subtitle }}</span>
    </div>

    <SimilarResultsGrid
      v-model:breadth="breadth"
      :items
      :scaled
      :searching
      :searched="picks.some((pick) => pick.result)"
      @open="(match: SimilarResultOpen, item: SimilarPickItem) => emit('open', match, item.pick)"
    >
      <template #badge="{ item }">
        <img v-if="picks.length > 1 && item.pick.request.crop" :src="item.pick.request.crop" alt="" class="multi-similar-badge" />
      </template>
    </SimilarResultsGrid>
  </div>
</template>

<script setup lang="ts">
import { hasScoreRange } from '@/components/CuiSimilarResults/utils.js';

import type { SimilarResultOpen } from '@/components/CuiSimilarResults/types.js';
import type { ChipPassThroughOptions } from 'openvue';
import type { CuiMultiSimilarResultsEmits, CuiMultiSimilarResultsProps, SimilarPick, SimilarPickItem } from './types.js';

const props = defineProps<CuiMultiSimilarResultsProps>();

const emit = defineEmits<CuiMultiSimilarResultsEmits>();

const breadth = defineModel<number>('breadth', { required: true });

const { t } = useI18n();

const CHIP_PT: ChipPassThroughOptions = {
  image: { class: 'object-cover bg-black/30' },
  label: { class: 'truncate max-w-32' },
};

const searching = computed(() => props.picks.some((pick) => pick.searching));

const scaled = computed(() => props.picks.some((pick) => hasScoreRange(pick.result)));

const subtitle = computed(() => {
  if (props.licenseRequired) return t('views.recordings.similar_license');
  if (!props.picks.some((pick) => pick.result)) return '';
  const count = t('views.recordings.similar_count', props.items.length);
  const kinds = new Set(props.items.map((item) => item.kind));
  if (kinds.size > 1) return `${count} · ${t('views.recordings.similar_surest_first')}`;
  return kinds.has('person') || kinds.has('appearance') ? `${count} · ${t('views.recordings.similar_best_first')}` : count;
});

function pickLabel(pick: SimilarPick): string {
  return pick.request.query.faceName || pick.request.query.plate || pick.camera.name;
}
</script>

<style scoped>
.multi-similar-results {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--p-content-background);
}

.multi-similar-bar {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background: var(--card-background);
}

.multi-similar-badge {
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
</style>
