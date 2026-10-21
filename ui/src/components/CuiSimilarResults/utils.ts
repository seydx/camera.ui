import { SIMILAR_SCORE_RANGES } from './types.js';

import type { SimilarMatch, SimilarMode, SimilarResult } from '@camera.ui/nvr';
import type { SimilarResultItem } from './types.js';

const SUREST_FIRST: SimilarMode[] = ['name', 'face', 'plate', 'person', 'appearance'];
const BEST_FIRST = new Set<SimilarMode>(['person', 'appearance']);

export function similarItems(result: SimilarResult | undefined, breadth: number): SimilarResultItem[] {
  if (!result) return [];
  const events = new Map(result.events.map((event) => [event.id, event]));
  const list: SimilarResultItem[] = [];
  const seen = new Set<string>();
  for (const match of result.matches) {
    const event = events.get(match.eventId);
    const range = scoreRange(result, match);
    const minScore = range ? range[1] - (breadth / 100) * (range[1] - range[0]) : 0;
    if (!event || match.score < minScore) continue;
    const segIndex = match.segment >= 0 && event.segments[match.segment] ? match.segment : undefined;
    const key = segIndex === undefined ? event.id : `${event.id}:seg:${segIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ key, event, segIndex, score: range ? match.score : undefined, kind: wayOf(result, match), time: match.time });
  }
  return list;
}

export function hasScoreRange(result: SimilarResult | undefined): boolean {
  if (!result) return false;
  return result.matches.some((match) => scoreRange(result, match) !== undefined);
}

export function mergeSimilarItems<T extends SimilarResultItem>(lists: T[][]): T[] {
  const sorted = lists.flat().sort((a, b) => SUREST_FIRST.indexOf(a.kind) - SUREST_FIRST.indexOf(b.kind) || withinWay(a, b));
  const whole = new Set<string>();
  const parted = new Set<string>();
  const seen = new Set<string>();
  return sorted.filter((item) => {
    const id = item.event.id;
    // a whole event covers its segments
    if (whole.has(id) || seen.has(item.key) || (item.segIndex === undefined && parted.has(id))) return false;
    seen.add(item.key);
    (item.segIndex === undefined ? whole : parted).add(id);
    return true;
  });
}

function scoreRange(result: SimilarResult, match: SimilarMatch): [number, number] | undefined {
  if (match.kind) return SIMILAR_SCORE_RANGES[match.kind];
  return result.mode === 'face' && result.label ? undefined : SIMILAR_SCORE_RANGES[result.mode];
}

function wayOf(result: SimilarResult, match: SimilarMatch): SimilarMode {
  if (match.kind) return match.kind;
  return result.mode === 'face' && result.label ? 'name' : result.mode;
}

function withinWay(a: SimilarResultItem, b: SimilarResultItem): number {
  return BEST_FIRST.has(a.kind) ? (b.score ?? 0) - (a.score ?? 0) : b.time - a.time;
}
