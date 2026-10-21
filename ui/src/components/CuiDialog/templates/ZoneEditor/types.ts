import type { AlertZone, CameraZones, DetectionLine, MotionZone, ObjectZone, PrivacyZone } from '@camera.ui/sdk';

export type ZoneEditorTab = 'motion' | 'object' | 'alert' | 'privacy' | 'lines';

export type EditorPolygon = MotionZone | ObjectZone | AlertZone | PrivacyZone;

export interface ZoneEditorProps {
  cameraName: string;
  zones: CameraZones;
  initialTab?: ZoneEditorTab;
  initialSelection?: number;
}

export interface ZoneEditorShapesProps {
  polygons: EditorPolygon[];
  lines: DetectionLine[];
  showLines: boolean;
  dashed: boolean;
  selectedZone: number;
  selectedLine: number;
  width: number;
  height: number;
}

export interface ZoneEditorShapesEmits {
  (e: 'select-zone', index: number): void;
  (e: 'drag-start', event: MouseEvent | TouchEvent, index: number): void;
  (e: 'drag-move', event: MouseEvent | TouchEvent): void;
  (e: 'drag-end'): void;
  (e: 'select-line', index: number): void;
  (e: 'line-handle-down', event: MouseEvent | TouchEvent, index: number, point: number): void;
}

export interface CoordsPosition {
  _id: string;
  zoneIndex: number;
  pointIndex: number;
  point: [number, number];
}

export interface LabelOption {
  label: string;
  value: string;
}

export interface LabelGroup {
  label: string;
  items: LabelOption[];
}

export type { DetectionLine };

export const NON_SPATIAL_LABELS = ['audio'];
export const NON_TRACKED_LABELS = ['audio', 'motion'];
