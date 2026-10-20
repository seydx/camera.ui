import type { RecordedEvent, TraceFaceRead } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';

export interface EventTraceProps {
  event: RecordedEvent;
  camera: DBCamera;
  startAtMs?: number;
  openedAt?: number;
}

export type TraceRead = TraceFaceRead & { empty?: true; failed?: true };
