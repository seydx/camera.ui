export interface LongPressPoint {
  clientX: number;
  clientY: number;
}

export interface LongPressOptions {
  onPress: (point: LongPressPoint) => void;
  // true when the tap was handled, the click after it is then swallowed
  onTouchTap?: (point: LongPressPoint) => boolean;
  delayMs?: number;
  tolerancePx?: number;
}

export interface LongPress {
  down: (event: PointerEvent) => void;
  move: (event: PointerEvent) => void;
  up: (event: PointerEvent) => void;
  cancel: () => void;
  takeClick: () => boolean;
}

export function createLongPress({ onPress, onTouchTap, delayMs = 400, tolerancePx = 10 }: LongPressOptions): LongPress {
  const pointers = new Set<number>();
  let start: (LongPressPoint & { id: number }) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let clickTaken = false;

  function cancel(): void {
    clearTimeout(timer);
    timer = undefined;
    start = undefined;
  }

  function down(event: PointerEvent): void {
    clickTaken = false;
    if (event.button !== 0) return;
    // a lost pointerup must not block the next press
    if (event.isPrimary) pointers.clear();
    pointers.add(event.pointerId);
    cancel();
    // a second finger is a pinch
    if (pointers.size > 1) return;
    const point = { clientX: event.clientX, clientY: event.clientY };
    start = { ...point, id: event.pointerId };
    timer = setTimeout(() => {
      timer = undefined;
      start = undefined;
      clickTaken = true;
      onPress(point);
    }, delayMs);
  }

  function move(event: PointerEvent): void {
    if (!start || event.pointerId !== start.id) return;
    if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > tolerancePx) cancel();
  }

  function up(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    if (start?.id !== event.pointerId) return;
    const point = { clientX: event.clientX, clientY: event.clientY };
    cancel();
    // ios drops the click when the hover of a tap changes the page, a touch tap is taken here
    if (event.type !== 'pointercancel' && event.pointerType === 'touch' && onTouchTap?.(point)) clickTaken = true;
  }

  // the click that ends a long press or a taken touch tap is no second tap
  function takeClick(): boolean {
    const was = clickTaken;
    clickTaken = false;
    return was;
  }

  return { down, move, up, cancel, takeClick };
}
