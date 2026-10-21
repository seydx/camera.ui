import type { NvrPlayback } from '@camera.ui/nvr';
import type { PlayStep, TimelineBlock } from './types.js';

const SHOWING_TOLERANCE_MS = 6000;
const CONTIGUOUS_MS = 1000;

export function noticeKey(ctrl: NvrPlayback): string | undefined {
  if (ctrl.mode.value === 'idle') return undefined;
  if (ctrl.licenseRequired.value) return 'components.player.license_required';
  if (ctrl.unsupported.value) return 'components.player.codec_unsupported_recording';
  if (ctrl.playbackError.value) return 'components.player.playback_failed';
  if (ctrl.noData.value) return 'components.player.no_recording';
  return undefined;
}

export function awaitingPicture(ctrl: NvrPlayback): boolean {
  if (noticeKey(ctrl)) return false;
  return ctrl.loading.value || (ctrl.mode.value === 'play' && ctrl.frameTimestamp.value <= 0);
}

export function showsPosition(ctrl: NvrPlayback, positionMs: number, playheadMs: number): boolean {
  if (ctrl.mode.value === 'idle') return false;
  if (noticeKey(ctrl)) return true;
  if (awaitingPicture(ctrl)) return false;
  return positionMs > 0 && Math.abs(positionMs - playheadMs) < SHOWING_TOLERANCE_MS;
}

export function playStep(lead: NvrPlayback, positionMs: number, block: TimelineBlock, next: TimelineBlock | undefined): PlayStep {
  if (lead.mode.value !== 'play' || awaitingPicture(lead) || positionMs <= 0) return 'hold';
  if (positionMs < block.endMs) return 'follow';
  if (!next) return 'end';
  return next.cameraId === block.cameraId && next.startMs - block.endMs <= CONTIGUOUS_MS ? 'continue' : 'switch';
}
