<template>
  <div class="recordings-toolbar flex flex-col gap-1 py-1.5">
    <template v-if="mobileSearchActive">
      <div class="flex items-center gap-1">
        <Button text rounded severity="secondary" class="shrink-0 cui-icon-md" @click="closeMobileSearch">
          <template #icon>
            <i-tabler:arrow-left width="100%" height="100%" />
          </template>
        </Button>
        <IconField class="flex-1 min-w-0">
          <InputIcon>
            <i-tabler:search class="w-3.5 h-3.5" />
          </InputIcon>
          <InputText ref="mobileSearchInputRef" v-model="search" :placeholder="$t('views.recordings.search_placeholder')" class="w-full !text-xs !py-1.5" />
        </IconField>
      </div>
    </template>

    <template v-else>
      <div v-if="compact" class="flex items-center gap-1">
        <IconField class="flex-1 min-w-0">
          <InputIcon>
            <i-tabler:search class="w-3.5 h-3.5" />
          </InputIcon>
          <InputText v-model="search" :placeholder="$t('views.recordings.search_placeholder')" class="w-full !text-xs !py-1.5" />
        </IconField>

        <Button
          v-if="gridSearch"
          v-tooltip.top="{ value: $t('views.recordings.grid_search') }"
          text
          rounded
          class="cui-icon-md shrink-0"
          :severity="gridSearch.active.value ? 'primary' : 'secondary'"
          @click="toggleGridSearch"
        >
          <template #icon>
            <i-tabler:grid-scan width="100%" height="100%" />
          </template>
        </Button>

        <Button
          v-tooltip.top="{ value: selectedDate ? formatSelectedDate : $t('views.recordings.date') }"
          text
          rounded
          class="cui-icon-md shrink-0"
          :severity="selectedDate ? 'primary' : 'secondary'"
          @click="(e: MouseEvent) => datePopoverRef?.toggle(e)"
        >
          <template #icon>
            <i-tabler:calendar width="100%" height="100%" />
          </template>
        </Button>

        <Button
          v-tooltip.top="{ value: $t('views.recordings.confidence') }"
          text
          rounded
          class="cui-icon-md shrink-0"
          :severity="minConfidence > 0 ? 'primary' : 'secondary'"
          @click="(e: MouseEvent) => confidencePopoverRef?.toggle(e)"
        >
          <template #icon>
            <i-tabler:percentage width="100%" height="100%" />
          </template>
        </Button>
      </div>

      <div v-if="!compact" class="flex items-center gap-1">
        <SelectButton
          v-model="selectedTypes"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          multiple
          :pt="{
            root: { class: 'flex gap-0.5' },
            pcToggleButton: { root: { class: '!px-2 !py-1.5 !text-xs' } },
          }"
        >
          <template #option="{ option }">
            <div v-tooltip.top="option.label" class="flex items-center">
              <component :is="option.icon" class="w-3.5 h-3.5" />
            </div>
          </template>
        </SelectButton>

        <Divider class="ml-auto" layout="vertical" />

        <div class="flex items-center gap-1 shrink-0">
          <Button
            v-if="gridSearch"
            v-tooltip.top="{ value: $t('views.recordings.grid_search') }"
            text
            rounded
            class="cui-icon-md"
            :severity="gridSearch.active.value ? 'primary' : 'secondary'"
            @click="toggleGridSearch"
          >
            <template #icon>
              <i-tabler:grid-scan width="100%" height="100%" />
            </template>
          </Button>

          <Button
            v-tooltip.top="{ value: selectedDate ? formatSelectedDate : $t('views.recordings.date') }"
            text
            rounded
            class="cui-icon-md"
            :severity="selectedDate ? 'primary' : 'secondary'"
            @click="(e: MouseEvent) => datePopoverRef?.toggle(e)"
          >
            <template #icon>
              <i-tabler:calendar width="100%" height="100%" />
            </template>
          </Button>

          <Button
            v-tooltip.top="{ value: $t('views.recordings.confidence') }"
            text
            rounded
            class="cui-icon-md"
            :severity="minConfidence > 0 ? 'primary' : 'secondary'"
            @click="(e: MouseEvent) => confidencePopoverRef?.toggle(e)"
          >
            <template #icon>
              <i-tabler:percentage width="100%" height="100%" />
            </template>
          </Button>

          <IconField class="hidden xl:flex">
            <InputIcon>
              <i-tabler:search class="w-3.5 h-3.5" />
            </InputIcon>
            <InputText v-model="search" :placeholder="$t('views.recordings.search_placeholder')" class="!text-xs !py-1.5 !w-36" />
          </IconField>
          <Button v-tooltip.top="{ value: $t('views.recordings.search') }" text rounded severity="secondary" class="xl:hidden cui-icon-md" @click="openMobileSearch">
            <template #icon>
              <i-tabler:search width="100%" height="100%" />
            </template>
          </Button>
        </div>
      </div>

      <SelectButton
        v-if="compact"
        v-model="selectedTypes"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        fluid
        multiple
        :pt="{
          root: { class: 'flex gap-0.5 flex-wrap' },
          pcToggleButton: { root: { class: '!px-2 !py-1.5 !text-xs' } },
        }"
      >
        <template #option="{ option }">
          <div v-tooltip.top="option.label" class="flex items-center">
            <component :is="option.icon" class="w-3.5 h-3.5" />
          </div>
        </template>
      </SelectButton>
    </template>

    <Popover ref="datePopoverRef" class="border-none" :pt="{ content: { class: 'p-0' } }">
      <div class="max-w-[305px]">
        <DatePicker
          v-model="selectedDate"
          :max-date="new Date()"
          inline
          :clear-button-props="{ class: 'hidden' }"
          class="hover:text-primary active:text-primary focus:text-primary text-muted-color"
          :pt="{
            pcInputText: {
              root: {
                class: 'text-sm !text-color',
              },
            },
            inputIconContainer: {
              class: 'transition-all text-current',
            },
          }"
        />
        <Button
          v-if="selectedDate"
          :label="$t('views.recordings.grid_clear')"
          severity="secondary"
          outlined
          size="small"
          class="text-xs mt-2"
          fluid
          @click="selectedDate = undefined"
        />
      </div>
    </Popover>

    <Popover ref="confidencePopoverRef" :pt="{ content: { class: 'p-3' } }">
      <div class="w-48 flex flex-col gap-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted">{{ $t('views.recordings.confidence') }}</span>
          <span class="font-mono">{{ Math.round(minConfidence * 100) }}%</span>
        </div>
        <Slider v-model="minConfidence" :min="0" :max="1" :step="0.05" class="w-full" />
        <Button
          v-if="minConfidence > 0"
          :label="$t('views.recordings.grid_clear')"
          severity="secondary"
          outlined
          size="small"
          class="text-xs"
          fluid
          @click="minConfidence = 0"
        />
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { EVENT_TYPE_OTHER } from '@camera.ui/nvr';
import { DETECTION_ATTRIBUTES, DETECTION_LABELS } from '@camera.ui/sdk';

import { GridSearchKey } from '@/components/CuiGridSearch/types.js';
import { resolveEventIcons } from '@/utils/eventIcons.js';

import type { CuiCameraRecordingsToolbarProps } from './types.js';

defineProps<CuiCameraRecordingsToolbarProps>();

const search = defineModel<string>('search', { required: true });
const selectedTypes = defineModel<string[]>('selectedTypes', { required: true });
const selectedDate = defineModel<Date | undefined>('selectedDate');
const minConfidence = defineModel<number>('minConfidence', { required: true });

const { t } = useI18n();

const gridSearch = inject(GridSearchKey, undefined);

const { icons: DETECTION_ICONS, generic: GENERIC_ICON } = resolveEventIcons();

const NON_FILTER_LABELS = new Set(['motion', 'audio']);

const typeOptions: { label: string; value: string; icon: Component }[] = [
  ...DETECTION_LABELS.filter((l) => !NON_FILTER_LABELS.has(l)).map((l) => ({
    label: t(`views.recordings.type_${l}`),
    value: l as string,
    icon: DETECTION_ICONS[l] ?? GENERIC_ICON,
  })),
  ...DETECTION_ATTRIBUTES.map((a) => ({
    label: t(`views.recordings.attr_${a}`),
    value: a as string,
    icon: DETECTION_ICONS[a] ?? GENERIC_ICON,
  })),
  {
    label: t('views.recordings.type_other'),
    value: EVENT_TYPE_OTHER,
    icon: DETECTION_ICONS['other'] ?? GENERIC_ICON,
  },
];

const mobileSearchActive = ref(false);
const mobileSearchInputRef = useTemplateRef<{ $el: HTMLElement }>('mobileSearchInputRef');
const datePopoverRef = useTemplateRef<{ toggle: (e: Event) => void; hide: () => void; show: (e: Event) => void }>('datePopoverRef');
const confidencePopoverRef = useTemplateRef<{ toggle: (e: Event) => void }>('confidencePopoverRef');

const formatSelectedDate = computed(() => {
  if (!selectedDate.value) return '';
  return selectedDate.value.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
});

function toggleGridSearch() {
  if (!gridSearch) return;
  gridSearch.active.value = !gridSearch.active.value;
  if (!gridSearch.active.value) gridSearch.regions.value = [];
}

function openMobileSearch() {
  mobileSearchActive.value = true;
  nextTick(() => mobileSearchInputRef.value?.$el?.focus());
}

function closeMobileSearch() {
  mobileSearchActive.value = false;
  search.value = '';
}
</script>

<style scoped>
.recordings-toolbar {
  flex-shrink: 0;
}

.recordings-toolbar-divider {
  width: 1px;
  height: 1.25rem;
  background: var(--border-color);
  flex-shrink: 0;
}

:deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: none !important;
  box-shadow: none !important;
}

:deep(.p-togglebutton.p-togglebutton-checked) {
  background: var(--p-primary-color) !important;
  color: var(--p-primary-contrast-color) !important;
  border-color: var(--p-primary-color) !important;
}

:deep(.p-togglebutton.p-togglebutton-checked:hover) {
  background: var(--p-primary-color) !important;
  border-color: var(--p-primary-color) !important;
}
</style>
