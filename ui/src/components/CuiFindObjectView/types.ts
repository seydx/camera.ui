import type { SimilarSearchRequest } from '@/components/CuiSimilarPicker/types.js';
import type { SimilarResultItem, SimilarResultOpen } from '@/components/CuiSimilarResults/types.js';
import type { SimilarResult, TimelineFindLayout, TimelineSegment } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';

export interface FindPick {
  id: number;
  camera: DBCamera;
  request: SimilarSearchRequest;
  result?: SimilarResult;
  searching: boolean;
}

export interface FindItem extends SimilarResultItem {
  pick: FindPick;
}

export interface FrozenPicture {
  release: (resume: boolean) => void;
}

export interface FindObjectState {
  segment: Ref<TimelineSegment>;
  views: ComputedRef<TimelineSegment[]>;
  available: ComputedRef<boolean>;
  armed: ComputedRef<boolean>;
  pickable: ComputedRef<boolean>;
  picks: ShallowRef<FindPick[]>;
  items: ComputedRef<FindItem[]>;
  keys: ComputedRef<string[] | undefined>;
  count: ComputedRef<number | undefined>;
  breadth: Ref<number>;
  licenseRequired: ShallowRef<boolean>;
  openedKey: ShallowRef<string | undefined>;
  add: (camera: DBCamera, request: SimilarSearchRequest) => void;
  remove: (id: number) => void;
  openView: () => void;
  toggleView: () => void;
  endSearch: () => void;
  track: (picture: FrozenPicture) => () => void;
  releaseAll: (resume: boolean) => void;
}

export const FindObjectKey: InjectionKey<FindObjectState> = Symbol('FindObject');

export interface CuiFindObjectViewProps {
  layout: TimelineFindLayout;
}

export interface CuiFindObjectViewEmits {
  open: [match: SimilarResultOpen, pick: FindPick];
  showAll: [requests: SimilarSearchRequest[]];
}
