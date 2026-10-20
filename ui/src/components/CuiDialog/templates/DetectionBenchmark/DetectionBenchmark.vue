<template>
  <div class="flex flex-col gap-4">
    <span class="text-sm text-pretty">{{ $t('views.metrics.benchmark_confirm') }}</span>

    <div v-if="!result" class="flex flex-col">
      <div class="flex justify-end">
        <Button
          severity="secondary"
          text
          class="cui-button-small"
          :label="allSelected ? $t('views.metrics.deselect_all') : $t('views.metrics.select_all')"
          @click="toggleAll"
        />
      </div>

      <div v-for="camera in cameras" :key="camera" class="cui-list-item">
        <CuiListItem :active="selected.includes(camera)" class="h-14" @click="toggle(camera)">
          <span>{{ camera }}</span>

          <template #append>
            <ToggleSwitch :model-value="selected.includes(camera)" @update:model-value="toggle(camera)" />
          </template>
        </CuiListItem>
      </div>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1 min-w-0">
          <Button v-if="pages.length > 1" severity="secondary" text rounded class="cui-icon-md" @click="page = (page - 1 + pages.length) % pages.length">
            <template #icon>
              <i-mdi:chevron-left />
            </template>
          </Button>
          <span class="text-sm font-semibold text-color truncate">{{ pages[page].title }}</span>
          <Button v-if="pages.length > 1" severity="secondary" text rounded class="cui-icon-md" @click="page = (page + 1) % pages.length">
            <template #icon>
              <i-mdi:chevron-right />
            </template>
          </Button>
        </div>

        <Button v-tooltip.left="$t('views.metrics.copy')" severity="secondary" text rounded class="cui-icon-md" @click="copyResult">
          <template #icon>
            <i-mdi:content-copy />
          </template>
        </Button>
      </div>

      <CuiDataTable :value="pages[page].rows" :rows="pages[page].rows.length" :pt="tablePtOptions" striped-rows :show-headers="false" class="w-full">
        <Column field="label">
          <template #body="{ data }">
            <span :class="['text-color', { 'font-semibold': data.host }]">{{ data.label }}</span>
          </template>
        </Column>
        <Column field="value" style="text-align: right">
          <template #body="{ data }">
            <span v-if="data.details?.length" v-tooltip.left="{ value: data.details.join(' · ') }" class="font-medium underline decoration-dotted">
              {{ data.value }}
            </span>
            <span v-else class="font-medium">{{ data.value }}</span>
          </template>
        </Column>
      </CuiDataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FrameWorkerQuery } from '@/api/routes/frameWorkers.js';

import type { CustomDialogComponent, DialogRefProps } from '@/composables/useCuiDialog.js';
import type { BenchmarkHost, ObjectBenchmarkResult, ObjectBenchmarkRun } from '@shared/types';
import type { DataTablePassThroughOptions } from 'primevue';
import type { DetectionBenchmarkProps } from './types.js';

const props = defineProps<DetectionBenchmarkProps>();

const { t } = useI18n();
const toast = useCuiToast();
const { copy } = useClipboard();
const dialogRefProps = inject<DialogRefProps>('dialogRefProps')!;

const tablePtOptions: DataTablePassThroughOptions = {
  bodyRow: {
    class: 'text-sm text-secondary',
  },
};

const { mutateAsync: runBenchmark } = new FrameWorkerQuery().benchmarkObjectDetectionQuery();

const selected = ref<string[]>([]);
const result = ref<ObjectBenchmarkRun>();
const page = ref(0);

const allSelected = computed(() => props.cameras.length > 0 && selected.value.length === props.cameras.length);

const pages = computed(() => {
  const run = result.value;
  if (!run) return [];

  const overview = [
    ...run.hosts.map(hostRow),
    { label: t('views.metrics.bench_cameras'), value: String(run.total.cameras) },
    { label: t('views.metrics.bench_calls'), value: `${run.total.iterations}${run.total.failed > 0 ? ` (+${run.total.failed} ✗)` : ''}` },
    { label: t('views.metrics.bench_concurrency'), value: String(run.total.concurrency) },
    ...effectiveRow(run.cameras.every((camera) => camera.effectiveConcurrency !== undefined) ? run.total.effectiveConcurrency : undefined),
    { label: t('views.metrics.bench_duration'), value: `${(run.total.totalMs / 1000).toFixed(1)} s` },
    { label: t('views.metrics.bench_rate'), value: `${run.total.perSecond}/s` },
    ...(run.hosts.length > 1
      ? []
      : [{ label: t('views.metrics.bench_per_camera'), value: `${Math.round((run.total.perSecond / Math.max(1, run.total.cameras)) * 10) / 10}/s` }]),
    { label: t('views.metrics.bench_handler'), value: `${run.total.handlerMs} ms` },
  ];

  return [{ title: t('views.metrics.benchmark_total'), rows: overview }, ...run.cameras.map((camera) => ({ title: camera.camera, rows: cameraRows(camera) }))];
});

function hostRow(host: BenchmarkHost) {
  const system = host.system;
  const details = system
    ? [
        `${t('views.metrics.bench_cpu')}: ${system.cpu} (${system.cores})`,
        `${t('views.metrics.bench_gpu')}: ${system.gpu ?? '-'}`,
        `${t('views.metrics.bench_memory')}: ${system.memoryGb} GB`,
        `${t('views.metrics.bench_os')}: ${system.os}`,
        `${t('views.metrics.bench_version')}: ${system.version}`,
      ]
    : [];

  return { label: t('views.metrics.bench_host'), value: host.worker ?? t('views.metrics.bench_host_server'), host: true, details };
}

function cameraRows(camera: ObjectBenchmarkResult) {
  return [
    { label: t('views.metrics.bench_host'), value: camera.worker ?? t('views.metrics.bench_host_server'), host: true },
    { label: t('views.metrics.col_object'), value: camera.plugin },
    { label: t('views.metrics.bench_runtime'), value: camera.runtime ?? '-' },
    ...(camera.models ?? []).map((model) => ({
      label: model.role ? `${t('views.metrics.bench_model')} (${model.role})` : t('views.metrics.bench_model'),
      value: [model.name, model.device, model.precision].filter(Boolean).join(' · '),
    })),
    { label: t('views.metrics.bench_input'), value: camera.input },
    { label: t('views.metrics.bench_calls'), value: `${camera.iterations}${camera.failed > 0 ? ` (+${camera.failed} ✗)` : ''}` },
    { label: t('views.metrics.bench_concurrency'), value: String(camera.concurrency) },
    ...effectiveRow(camera.effectiveConcurrency),
    { label: t('views.metrics.bench_duration'), value: `${(camera.totalMs / 1000).toFixed(1)} s` },
    { label: t('views.metrics.bench_rate'), value: `${camera.perSecond}/s` },
    { label: t('views.metrics.bench_handler'), value: `${camera.handlerMs} ms` },
  ];
}

function effectiveRow(effectiveConcurrency?: number) {
  return effectiveConcurrency === undefined ? [] : [{ label: t('views.metrics.bench_effective_concurrency'), value: String(effectiveConcurrency) }];
}

function toggle(camera: string) {
  selected.value = selected.value.includes(camera) ? selected.value.filter((name) => name !== camera) : [...selected.value, camera];
}

function toggleAll() {
  selected.value = allSelected.value ? [] : [...props.cameras];
}

async function copyResult() {
  const asText = (entry: (typeof pages.value)[number]) =>
    [entry.title, ...entry.rows.flatMap((row) => [`${row.label}: ${row.value}`, ...(('details' in row && row.details) || [])])].join('\n');
  const text = page.value === 0 ? pages.value.map(asText).join('\n\n---\n\n') : asText(pages.value[page.value]);

  await copy(text);
  toast.add({ severity: 'success', detail: t('views.metrics.copied'), life: 3000 });
}

async function onConfirm(): Promise<void | null> {
  try {
    result.value = await runBenchmark({ cameras: selected.value });
    if (dialogRefProps.hideConfirmButton) dialogRefProps.hideConfirmButton.value = true;
    return null;
  } catch (error: any) {
    toast.add({ severity: 'error', detail: error?.response?.data?.message ?? error?.message, life: 5000 });
  }
}

watchEffect(() => {
  if (dialogRefProps.disabled) dialogRefProps.disabled.value = selected.value.length === 0;
});

defineExpose<CustomDialogComponent>({ onConfirm });
</script>
