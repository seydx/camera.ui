import { mergeSimilarItems, similarItems } from '@/components/CuiSimilarResults/utils.js';

import type { FindItem, FindPick } from './types.js';

export function findItems(picks: FindPick[], breadth: number): FindItem[] {
  return mergeSimilarItems(picks.map((pick) => similarItems(pick.result, breadth).map((item) => ({ ...item, pick }))));
}

export function pickLabel(pick: FindPick): string {
  return pick.request.query.faceName || pick.request.query.plate || pick.camera.name;
}
