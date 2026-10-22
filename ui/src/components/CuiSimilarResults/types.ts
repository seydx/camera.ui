import type { RecordedEvent, SimilarMode, TimelineFindLayout } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';

export interface SimilarResultOpen {
  event: RecordedEvent;
  camera?: DBCamera;
  timestamp: number;
}

export interface SimilarResultsGridProps<T extends SimilarResultItem> {
  items: T[];
  scaled: boolean;
  searching: boolean;
  searched: boolean;
  layout?: TimelineFindLayout;
  activeKey?: string;
}

export interface SimilarResultsGridEmits<T extends SimilarResultItem> {
  open: [match: SimilarResultOpen, item: T];
}

export const SIMILAR_PANEL_WIDTH = 280;

export const SIMILAR_CARD_GAP = 8;

export interface SimilarResultItem {
  key: string;
  event: RecordedEvent;
  segIndex?: number;
  score?: number;
  kind: SimilarMode;
  time: number;
}

export const SIMILAR_SCORE_RANGES: Partial<Record<SimilarMode, [number, number]>> = {
  person: [0.4, 0.65],
  face: [0.25, 0.45],
  appearance: [0.8, 0.92],
};
