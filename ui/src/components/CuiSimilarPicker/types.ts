import type { FrameObject, SimilarQuery } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';

export interface SimilarPickPoint {
  x: number;
  y: number;
}

export interface CuiSimilarPickerProps {
  camera: DBCamera;
  frame?: Blob;
  point?: SimilarPickPoint;
  still?: boolean;
  continuable?: boolean;
}

export interface CuiSimilarPickerEmits {
  pick: [object: FrameObject & { query: SimilarQuery }];
  continue: [];
}

export interface SimilarSearchRequest {
  query: SimilarQuery;
  objectLabel: string;
  crop?: string;
}

export const TOUCH_SLOP_PX = 16;
