<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col field-gap">
      <label class="cui-label">{{ t('components.automation_nodes.camera') }}</label>
      <Select
        :model-value="data.cameraId"
        :options="cameraOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('components.automation_nodes.camera_placeholder')"
        class="w-full"
        @update:model-value="update('cameraId', $event)"
      />
    </div>

    <CuiToggleRow :label="t('components.automation_nodes.snapshot_force_new')" :hint="t('components.automation_nodes.snapshot_force_new_hint')">
      <ToggleSwitch :model-value="data.forceNew" @update:model-value="update('forceNew', $event)" />
    </CuiToggleRow>
  </div>
</template>

<script setup lang="ts">
import { useCameraOptions } from './useCameraOptions.js';

import type { ConfigActionSnapshotProps, ConfigNodeUpdateEmits } from '../types.js';

defineProps<ConfigActionSnapshotProps>();

const emit = defineEmits<ConfigNodeUpdateEmits>();

const { t } = useI18n();
const { cameraOptions } = useCameraOptions();

function update(key: string, value: unknown) {
  emit('update:data', { [key]: value });
}
</script>
