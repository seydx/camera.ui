<template>
  <div class="similar-search-bar">
    <div v-if="crops.length > 1" class="flex shrink-0">
      <img v-for="crop in crops.slice(0, 3)" :key="crop" :src="crop" alt="" class="similar-search-stack" />
    </div>
    <div v-else class="similar-search-crop">
      <img v-if="crops[0]" :src="crops[0]" alt="" class="w-full h-full object-contain" />
      <i-tabler:zoom-scan v-else class="w-5 h-5 text-muted" />
    </div>

    <div class="flex flex-col min-w-0 flex-1">
      <span class="text-sm font-semibold truncate">{{ title }}</span>
      <span v-if="subtitle" class="text-xs text-muted truncate">{{ subtitle }}</span>
    </div>

    <i-svg-spinners:ring-resize v-if="searching" class="w-4 h-4 shrink-0 text-muted" />

    <Button
      v-tooltip.bottom="{ value: $t('views.recordings.similar_clear') }"
      severity="secondary"
      text
      rounded
      class="shrink-0"
      :aria-label="$t('views.recordings.similar_clear')"
      @click="emit('close')"
    >
      <template #icon>
        <i-tabler:x class="w-4 h-4" />
      </template>
    </Button>
  </div>
</template>

<script setup lang="ts">
import type { SimilarSearchBarEmits, SimilarSearchBarProps } from './types.js';

const props = defineProps<SimilarSearchBarProps>();

const emit = defineEmits<SimilarSearchBarEmits>();

const { t } = useI18n();

const title = computed(() => {
  if (props.licenseRequired) return t('views.recordings.similar_license');
  const [result] = props.results;
  if (!result) return props.searching ? t('views.recordings.similar_searching') : t('views.recordings.similar_failed');
  if (props.results.length > 1) return t('views.recordings.similar_several', { count: props.results.length });
  switch (result.mode) {
    case 'face':
      return result.label ? t('views.recordings.similar_face', { name: result.label }) : t('views.recordings.similar_unknown_face');
    case 'person':
      return t('views.recordings.similar_person');
    case 'plate':
      return t('views.recordings.similar_plate', { plate: result.label ?? '' });
    case 'appearance':
      return t('views.recordings.similar_appearance');
    default:
      return props.objectLabel === 'vehicle' ? t('components.similar.no_vehicle_notice') : t('components.similar.no_face_notice');
  }
});

const subtitle = computed(() => {
  const results = props.results.filter((result) => result.mode !== 'none');
  if (props.licenseRequired || !results.length) return '';
  const count = t('views.recordings.similar_count', props.count);
  const modes = new Set(results.map((result) => result.mode));
  if (modes.size > 1 || results.some((result) => result.matches.some((match) => match.kind))) return `${count} · ${t('views.recordings.similar_surest_first')}`;
  return modes.has('appearance') || modes.has('person') ? `${count} · ${t('views.recordings.similar_best_first')}` : count;
});
</script>

<style scoped>
.similar-search-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background: var(--card-background);
}

.similar-search-stack {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  object-fit: cover;
  background: rgb(0 0 0 / 0.3);
  box-shadow: 0 0 0 2px var(--card-background);
}

.similar-search-stack + .similar-search-stack {
  margin-left: -10px;
}

.similar-search-crop {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 0.5rem;
  background: rgb(128 128 128 / 0.15);
}
</style>
