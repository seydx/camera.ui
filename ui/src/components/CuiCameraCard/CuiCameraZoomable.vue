<template>
  <VueZoomable v-model:pan="pan" v-model:zoom="zoom" :pan-enabled="zoom > 1">
    <slot />
  </VueZoomable>
</template>

<script setup lang="ts">
import VueZoomable from 'vue-zoomable';

import type { CuiCameraZoomableProps } from './types.js';

const props = defineProps<CuiCameraZoomableProps>();

// the card hands over its refs, so a pinch frame renders this box and not the whole card
const { pan, zoom } = props.state;
</script>
