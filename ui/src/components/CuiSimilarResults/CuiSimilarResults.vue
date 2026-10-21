<template>
  <div class="similar-results">
    <SimilarSearchBar
      class="mx-3"
      :crop="request.crop"
      :object-label="request.objectLabel"
      :result="result"
      :count="items.length"
      :searching="isSearching || !isAvailable"
      :license-required="licenseRequired"
      @close="emit('close')"
    />

    <SimilarResultsGrid
      v-model:breadth="breadth"
      :items
      :scaled
      :searching="isSearching"
      :searched="Boolean(result && result.mode !== 'none')"
      @open="(match: SimilarResultOpen) => emit('open', match)"
    />

    <div class="p-3 shrink-0" :class="{ 'pb-safe-offset-3': safeBottom }">
      <Button :label="t('components.similar.show_all')" severity="secondary" size="small" class="w-full" @click="emit('showAll')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSimilarSearch } from '@camera.ui/nvr';

import { hasScoreRange, similarItems } from './utils.js';

import type { CuiSimilarResultsEmits, CuiSimilarResultsProps, SimilarResultOpen } from './types.js';

const props = defineProps<CuiSimilarResultsProps>();

const emit = defineEmits<CuiSimilarResultsEmits>();

const { t } = useI18n();
const { result, isSearching, isAvailable, licenseRequired, search, clear } = useSimilarSearch();

const breadth = ref(100);

const scaled = computed(() => hasScoreRange(result.value));

const items = computed(() => similarItems(result.value, breadth.value));

watch(items, (list) => {
  emit(
    'shown',
    list.map((item) => item.key),
  );
});

watch(
  [() => props.request, isAvailable],
  ([request, available]) => {
    breadth.value = 100;
    if (available) search(request.query, {});
  },
  { immediate: true },
);

onBeforeUnmount(clear);
</script>

<style scoped>
.similar-results {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--p-content-background);
}
</style>
