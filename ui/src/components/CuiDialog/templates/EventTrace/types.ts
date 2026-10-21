import type { RecordedEvent, TraceFaceRead, TraceFrame } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';

export interface EventTraceProps {
  event: RecordedEvent;
  camera: DBCamera;
  startAtMs?: number;
  openedAt?: number;
}

export interface EventTraceScrubberProps {
  frames: TraceFrame[];
  startMs: number;
  endMs: number;
  playhead: () => number;
}

export interface EventTraceScrubberEmits {
  scrubDown: [tMs: number];
  scrubMove: [tMs: number];
  scrubUp: [tMs: number];
}

export type TraceRead = TraceFaceRead & { empty?: true; failed?: true };
