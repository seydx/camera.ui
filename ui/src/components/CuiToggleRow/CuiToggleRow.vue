<template>
  <div class="flex flex-col field-gap" :class="{ 'cui-toggle-switch': !plain }">
    <div class="flex items-center gap-4">
      <div class="flex min-w-0 flex-col field-switch-gap">
        <label :for="labelFor" :class="plain ? 'text-sm font-bold text-color' : 'cui-label-switch'">{{ label }}</label>
        <slot name="hint">
          <Message v-if="hint" severity="secondary" variant="simple" size="small" class="cui-input-switch-hint">{{ hint }}</Message>
        </slot>
        <Transition v-if="errorName" name="fade">
          <ErrorMessage :name="errorName" class="cui-input-switch-error" />
        </Transition>
      </div>
      <div class="ml-auto flex shrink-0">
        <slot />
      </div>
    </div>
    <slot name="below" />
  </div>
</template>

<script setup lang="ts">
import { ErrorMessage } from 'vee-validate';

import type { CuiToggleRowProps } from './types.js';

defineProps<CuiToggleRowProps>();
</script>
