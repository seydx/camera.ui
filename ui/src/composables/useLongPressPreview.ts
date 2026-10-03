import type { MaybeElementRef } from '@vueuse/core';

const LONG_PRESS_MS = 350;
const EMULATED_MOUSE_WINDOW_MS = 1000;

export function useLongPressPreview(target: MaybeElementRef, onStart: () => void, onEnd: () => void) {
  let active = false;
  let suppressClick = false;
  let lastTouchAt = 0;

  onLongPress(
    target,
    (event) => {
      if (event.pointerType !== 'touch') return;
      active = true;
      suppressClick = true;
      onStart();
    },
    { delay: LONG_PRESS_MS },
  );

  useEventListener(
    () => unrefElement(target),
    ['pointerup', 'pointercancel', 'pointerleave'],
    (event: PointerEvent) => {
      if (event.pointerType === 'touch') lastTouchAt = Date.now();
      if (!active) return;
      active = false;
      onEnd();
    },
  );

  // the click right after a released long-press must not open the card
  function consumesClick(): boolean {
    const consumed = suppressClick;
    suppressClick = false;
    return consumed;
  }

  // browsers replay touch taps as mouseenter+click; the emulated mouseenter
  // must not start a hover preview on top of the tap
  function blocksMouseEnter(): boolean {
    return Date.now() - lastTouchAt < EMULATED_MOUSE_WINDOW_MS;
  }

  return { consumesClick, blocksMouseEnter };
}
