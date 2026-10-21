<template>
  <div v-if="style" :style="style" />
</template>

<script setup lang="ts">
import type { CuiCameraMinimapViewportProps } from './types.js';

const props = defineProps<CuiCameraMinimapViewportProps>();

const style = computed(() => props.viewportStyle());
</script>
