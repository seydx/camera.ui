import type { SimilarSearchRequest } from '@/components/CuiSimilarPicker/types.js';
import type { SimilarResultItem, SimilarResultOpen } from '@/components/CuiSimilarResults/types.js';
import type { SimilarResult } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';

export interface SimilarPick {
  id: number;
  camera: DBCamera;
  request: SimilarSearchRequest;
  result?: SimilarResult;
  searching: boolean;
}

export interface SimilarPickItem extends SimilarResultItem {
  pick: SimilarPick;
}

export interface CuiMultiSimilarResultsProps {
  picks: SimilarPick[];
  items: SimilarPickItem[];
  licenseRequired: boolean;
}

export interface CuiMultiSimilarResultsEmits {
  open: [match: SimilarResultOpen, pick: SimilarPick];
  remove: [id: number];
  close: [];
}
