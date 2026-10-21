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
}

export interface CuiSimilarPickerEmits {
  pick: [object: FrameObject & { query: SimilarQuery }];
  close: [];
}

export interface SimilarSearchRequest {
  query: SimilarQuery;
  objectLabel: string;
  crop?: string;
}

export interface SimilarGridState {
  active: Ref<boolean>;
  pick: (camera: DBCamera, request: SimilarSearchRequest) => void;
}

export const SimilarGridKey: InjectionKey<SimilarGridState> = Symbol('SimilarGridState');
