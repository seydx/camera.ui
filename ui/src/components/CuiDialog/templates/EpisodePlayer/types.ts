import type { RecordedEpisode } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';

export interface EpisodePlayerProps {
  episode: RecordedEpisode;
  cameraById: Map<string, DBCamera>;
}

export interface TimelineBlock {
  cameraId: string;
  startMs: number;
  endMs: number;
  offsetMs: number;
}

export type PlayStep = 'hold' | 'follow' | 'continue' | 'switch' | 'end';
