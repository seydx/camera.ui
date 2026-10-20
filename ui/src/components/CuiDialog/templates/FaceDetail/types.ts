export type FaceDetailMarkKind = 'filed_under' | 'unclear' | 'unlike' | 'partly_visible' | 'same_as';

export interface FaceDetailMark {
  kind: FaceDetailMarkKind;
  text: string;
  danger: boolean;
}

export interface FaceDetailFaceImage {
  id: string;
  src?: string;
  confidence: number;
  clarity?: number;
  sameAs?: string;
  alsoFiledUnder?: string[];
  unlike?: boolean;
}

export interface FaceDetailFace {
  name: string;
  imageCount: number;
  images: FaceDetailFaceImage[];
  loading?: boolean;
}

export interface FaceDetailProps {
  face: FaceDetailFace;
  onRemoveImage: (idx: number) => void;
  onDeletePerson: () => void;
}
