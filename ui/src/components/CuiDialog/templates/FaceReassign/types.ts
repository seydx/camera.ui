export interface FaceReassignProps {
  cropUrl?: string;
  oldName: string;
  eventId: string;
  segIndex: number;
  attrIndex?: number;
  confidence?: number;
}
