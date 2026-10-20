export class Slots {
  private used = 0;
  private waiting: (() => void)[] = [];

  constructor(private size: number) {}

  public async run<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    await this.acquire(signal);
    try {
      return await work();
    } finally {
      this.release();
    }
  }

  private acquire(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.used < this.size) {
      this.used++;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const waiter = (): void => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      };
      const onAbort = (): void => {
        this.waiting = this.waiting.filter((entry) => entry !== waiter);
        reject(signal.reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiting.push(waiter);
    });
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.used--;
    }
  }
}

export class KeyedLock {
  private tails = new Map<string, Promise<void>>();

  public async run<T>(key: string, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const tail = previous.then(() => held);
    this.tails.set(key, tail);

    try {
      await untilAborted(previous, signal);
      return await work();
    } finally {
      release();
      // an aborted waiter still leaves the key to the holder before it
      tail.then(() => {
        if (this.tails.get(key) === tail) {
          this.tails.delete(key);
        }
      });
    }
  }
}

function untilAborted(promise: Promise<void>, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    });
  });
}
