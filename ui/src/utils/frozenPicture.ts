export type PlayerMode = 'idle' | 'scrub' | 'play' | 'pause';

export type FrozenReaction = 'keep' | 'follow' | 'release';

export interface FrozenPlayerState {
  mode: PlayerMode;
  liveRunning: boolean;
  stillFrom: 'live' | 'playback';
  movedMs: number;
}

// a scrub shorter than this keeps the still and its marks
const FOLLOW_MIN_MS = 1000;

export function frozenReaction({ mode, liveRunning, stillFrom, movedMs }: FrozenPlayerState): FrozenReaction {
  if (mode === 'play') return 'release';
  if (mode === 'idle') return stillFrom === 'playback' || liveRunning ? 'release' : 'keep';
  if (stillFrom === 'live') return 'follow';
  return Math.abs(movedMs) > FOLLOW_MIN_MS ? 'follow' : 'keep';
}
