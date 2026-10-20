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

  function consumesClick(): boolean {
    const consumed = suppressClick;
    suppressClick = false;
    return consumed;
  }

  function blocksMouseEnter(): boolean {
    // browsers replay a tap as mouseenter and click, the emulated mouseenter must not start a preview
    return Date.now() - lastTouchAt < EMULATED_MOUSE_WINDOW_MS;
  }

  return { consumesClick, blocksMouseEnter };
}
