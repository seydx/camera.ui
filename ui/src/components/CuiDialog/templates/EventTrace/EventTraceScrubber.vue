<template>
  <span class="text-xs font-mono text-white tabular-nums shrink-0 ml-1">{{ clock(playhead() - startMs) }}</span>
  <div
    ref="scrubRef"
    class="flex-1 h-6 flex items-center cursor-pointer touch-none select-none"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="relative w-full h-1.5 rounded-full bg-white/25">
      <div v-for="mark in scrubMarks" :key="mark" class="absolute top-0 bottom-0 w-px bg-white/60" :style="{ left: `${mark}%` }" />
      <div class="absolute inset-y-0 left-0 rounded-full bg-primary-500" :style="{ width: `${playedPct}%` }" />
      <div class="scrub-knob" :style="{ left: `${playedPct}%` }" />
    </div>
  </div>
  <span class="text-xs font-mono text-white/70 tabular-nums shrink-0">{{ clock(endMs - startMs) }}</span>
</template>

<script setup lang="ts">
import type { EventTraceScrubberEmits, EventTraceScrubberProps } from './types.js';

const props = defineProps<EventTraceScrubberProps>();

const emit = defineEmits<EventTraceScrubberEmits>();

const scrubRef = useTemplateRef<HTMLElement>('scrubRef');

let dragging = false;

const playedPct = computed(() => scrubFraction(props.playhead()) * 100);
const scrubMarks = computed(() => {
  const marks = new Set<number>();
  for (const frame of props.frames) {
    if (frame.tick.world.length > 0) marks.add(Math.round(scrubFraction(frame.tick.tMs) * 1000) / 10);
  }
  return [...marks];
});

function clock(ms: number): string {
  const total = Math.max(ms, 0) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function scrubFraction(tMs: number): number {
  const span = props.endMs - props.startMs;
  if (span <= 0) return 0;
  return Math.min(Math.max((tMs - props.startMs) / span, 0), 1);
}

function scrubPosition(e: PointerEvent): number {
  const rect = scrubRef.value!.getBoundingClientRect();
  const fraction = Math.min(Math.max((e.clientX - rect.left) / Math.max(rect.width, 1), 0), 1);
  return props.startMs + fraction * (props.endMs - props.startMs);
}

function onPointerDown(e: PointerEvent): void {
  scrubRef.value!.setPointerCapture(e.pointerId);
  dragging = true;
  emit('scrubDown', scrubPosition(e));
}

function onPointerMove(e: PointerEvent): void {
  if (dragging) emit('scrubMove', scrubPosition(e));
}

function onPointerUp(e: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  emit('scrubUp', scrubPosition(e));
}
</script>

<style scoped>
.scrub-knob {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 9999px;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.3);
}
</style>
