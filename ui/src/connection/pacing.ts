export interface ThrottleClock {
  readonly now: () => number;
  readonly setTimer: (cb: () => void, ms: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
}

export interface TrailingThrottle {
  request(): void;
  mark(): void;
  dispose(): void;
}

const SYSTEM_CLOCK: ThrottleClock = {
  now: () => Date.now(),
  setTimer: (cb, ms) => setTimeout(cb, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function jitteredSchedule(base: readonly number[], spread: number, random: () => number = Math.random): readonly number[] {
  return new Proxy([...base], {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const value = target[Number(prop)];
        return value === undefined ? undefined : Math.round(value * (1 + spread * (2 * random() - 1)));
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function createTrailingThrottle(windowMs: number, run: () => void, clock: ThrottleClock = SYSTEM_CLOCK): TrailingThrottle {
  let lastRunAt = Number.NEGATIVE_INFINITY;
  let timer: unknown;

  function cancel(): void {
    if (timer === undefined) return;
    clock.clearTimer(timer);
    timer = undefined;
  }

  function fire(): void {
    timer = undefined;
    lastRunAt = clock.now();
    run();
  }

  return {
    request() {
      if (timer !== undefined) return;
      const waitMs = lastRunAt + windowMs - clock.now();
      if (waitMs <= 0) fire();
      else timer = clock.setTimer(fire, waitMs);
    },
    mark() {
      cancel();
      lastRunAt = clock.now();
    },
    dispose() {
      cancel();
    },
  };
}
