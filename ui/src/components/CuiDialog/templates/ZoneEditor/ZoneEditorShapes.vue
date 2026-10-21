<template>
  <svg width="100%" height="100%" class="polygon-container">
    <template v-if="!showLines">
      <path
        v-for="(zone, i) in polygons"
        :key="`poly-${i}`"
        :d="convertToSvgPath(zone.points)"
        class="cursor-pointer"
        :class="{ dash: dashed, selected: selectedZone === i }"
        :style="polygonStyle(zone)"
        @click="emit('select-zone', i)"
        @mousedown="emit('drag-start', $event, i)"
        @mousemove="emit('drag-move', $event)"
        @mouseup="emit('drag-end')"
        @touchstart="emit('drag-start', $event, i)"
        @touchmove="emit('drag-move', $event)"
        @touchend="emit('drag-end')"
      />
    </template>

    <template v-if="showLines">
      <defs>
        <marker
          v-for="(line, i) in lines"
          :id="`editor-arrow-ab-${i}`"
          :key="`marker-ab-${i}`"
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L6,2.5 L0,5 Z" :fill="line.color" />
        </marker>
        <marker
          v-for="(line, i) in lines"
          :id="`editor-arrow-ba-${i}`"
          :key="`marker-ba-${i}`"
          markerWidth="6"
          markerHeight="5"
          refX="1"
          refY="2.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M6,0 L0,2.5 L6,5 Z" :fill="line.color" />
        </marker>
      </defs>
      <template v-for="(line, i) in lines" :key="`line-${i}`">
        <line
          :x1="lineSvgEditor(line).h1x"
          :y1="lineSvgEditor(line).h1y"
          :x2="lineSvgEditor(line).h2x"
          :y2="lineSvgEditor(line).h2y"
          :stroke="line.color"
          stroke-width="2"
          stroke-dasharray="6,4"
          opacity="0.6"
        />
        <line
          :x1="lineSvgEditor(line).ax"
          :y1="lineSvgEditor(line).ay"
          :x2="lineSvgEditor(line).bx"
          :y2="lineSvgEditor(line).by"
          :stroke="line.color"
          stroke-width="3"
          class="cursor-pointer"
          :stroke-opacity="selectedLine === i ? 1 : 0.7"
          :marker-end="line.direction !== 'b-to-a' ? `url(#editor-arrow-ab-${i})` : undefined"
          :marker-start="line.direction !== 'a-to-b' ? `url(#editor-arrow-ba-${i})` : undefined"
          @click="emit('select-line', i)"
        />
        <rect :x="lineSvgEditor(line).labelAx - 9" :y="lineSvgEditor(line).labelAy - 9" width="18" height="18" rx="4" :fill="line.color" />
        <text
          :x="lineSvgEditor(line).labelAx"
          :y="lineSvgEditor(line).labelAy"
          fill="#fff"
          font-size="11"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="central"
        >
          A
        </text>
        <rect :x="lineSvgEditor(line).labelBx - 9" :y="lineSvgEditor(line).labelBy - 9" width="18" height="18" rx="4" :fill="line.color" />
        <text
          :x="lineSvgEditor(line).labelBx"
          :y="lineSvgEditor(line).labelBy"
          fill="#fff"
          font-size="11"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="central"
        >
          B
        </text>
        <circle
          :cx="lineSvgEditor(line).h1x"
          :cy="lineSvgEditor(line).h1y"
          r="8"
          :fill="line.color"
          :stroke="selectedLine === i ? '#fff' : line.color"
          stroke-width="2"
          class="cursor-grab"
          @mousedown.stop="emit('line-handle-down', $event, i, 0)"
          @touchstart.stop="emit('line-handle-down', $event, i, 0)"
        />
        <circle
          :cx="lineSvgEditor(line).h2x"
          :cy="lineSvgEditor(line).h2y"
          r="8"
          :fill="line.color"
          :stroke="selectedLine === i ? '#fff' : line.color"
          stroke-width="2"
          class="cursor-grab"
          @mousedown.stop="emit('line-handle-down', $event, i, 1)"
          @touchstart.stop="emit('line-handle-down', $event, i, 1)"
        />
      </template>
    </template>
  </svg>
</template>

<script setup lang="ts">
import type { DetectionLine } from '@camera.ui/sdk';
import type { EditorPolygon, ZoneEditorShapesEmits, ZoneEditorShapesProps } from './types.js';

const props = defineProps<ZoneEditorShapesProps>();
const emit = defineEmits<ZoneEditorShapesEmits>();

function polygonStyle(zone: EditorPolygon): Record<string, string> {
  if (!('color' in zone)) {
    return { fill: '#000', stroke: '#000', 'stroke-width': '2' };
  }
  return { fill: `${zone.color}4D`, stroke: zone.color, 'stroke-width': '2' };
}

function convertToSvgPath(points: [number, number][]): string {
  if (!points || !points.length) {
    return '';
  }

  const svgPoints = points.map((point) => {
    const x = Math.round((point[0] / 100) * props.width);
    const y = Math.round((point[1] / 100) * props.height);
    return `${x + 10},${y + 10}`;
  });

  if (svgPoints.length === 0) {
    return '';
  }

  let path = `M ${svgPoints[0]}`;
  for (let i = 1; i < svgPoints.length; i++) {
    path += ` L ${svgPoints[i]}`;
  }
  path += ' Z';

  return path;
}

function lineSvgEditor(line: DetectionLine) {
  const cw = props.width;
  const ch = props.height;
  const pad = 10;

  const h1px = (line.points[0][0] / 100) * cw + pad;
  const h1py = (line.points[0][1] / 100) * ch + pad;
  const h2px = (line.points[1][0] / 100) * cw + pad;
  const h2py = (line.points[1][1] / 100) * ch + pad;

  const mx = (h1px + h2px) / 2;
  const my = (h1py + h2py) / 2;

  const hdx = h2px - h1px;
  const hdy = h2py - h1py;
  const hLen = Math.sqrt(hdx * hdx + hdy * hdy) || 1;

  const perpX = -hdy;
  const perpY = hdx;

  const rawAx = mx - perpX / 2;
  const rawAy = my - perpY / 2;
  const rawBx = mx + perpX / 2;
  const rawBy = my + perpY / 2;

  const ux = perpX / hLen;
  const uy = perpY / hLen;

  const minX = pad;
  const maxX = pad + cw;
  const minY = pad;
  const maxY = pad + ch;
  const labelHalf = 9; // half of 18px rect
  const gap = 6; // gap between arrow tip and label

  const clamp = (x: number, y: number) => ({
    x: Math.max(minX + labelHalf, Math.min(maxX - labelHalf, x)),
    y: Math.max(minY + labelHalf, Math.min(maxY - labelHalf, y)),
  });
  const outset = labelHalf + gap + 6; // label half + gap + arrow marker size
  const labelA = clamp(rawAx - ux * outset, rawAy - uy * outset);
  const labelB = clamp(rawBx + ux * outset, rawBy + uy * outset);

  const lineInset = labelHalf + gap;
  const ax = labelA.x + ux * lineInset;
  const ay = labelA.y + uy * lineInset;
  const bx = labelB.x - ux * lineInset;
  const by = labelB.y - uy * lineInset;

  return {
    h1x: h1px,
    h1y: h1py,
    h2x: h2px,
    h2y: h2py,
    ax,
    ay,
    bx,
    by,
    labelAx: labelA.x,
    labelAy: labelA.y,
    labelBx: labelB.x,
    labelBy: labelB.y,
  };
}
</script>

<style lang="scss" scoped>
path {
  &.selected {
    stroke-width: 2;
  }

  &.dash {
    stroke-dasharray: 5, 5;
  }
}
</style>
