export interface LongPressPoint {
  clientX: number;
  clientY: number;
}

export interface LongPressOptions {
  onPress: (point: LongPressPoint) => void;
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

export function createLongPress({ onPress, delayMs = 400, tolerancePx = 10 }: LongPressOptions): LongPress {
  const pointers = new Set<number>();
  let start: (LongPressPoint & { id: number }) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pressed = false;

  function cancel(): void {
    clearTimeout(timer);
    timer = undefined;
    start = undefined;
  }

  function down(event: PointerEvent): void {
    pressed = false;
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
      pressed = true;
      onPress(point);
    }, delayMs);
  }

  function move(event: PointerEvent): void {
    if (!start || event.pointerId !== start.id) return;
    if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > tolerancePx) cancel();
  }

  function up(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    if (start?.id === event.pointerId) cancel();
  }

  // the click that ends a long press is not a tap
  function takeClick(): boolean {
    const was = pressed;
    pressed = false;
    return was;
  }

  return { down, move, up, cancel, takeClick };
}
