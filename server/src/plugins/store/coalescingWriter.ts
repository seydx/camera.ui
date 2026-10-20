interface PendingFlush {
  snapshot: Record<string, any>;
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class CoalescingWriter {
  #inFlight?: Promise<void>;
  #pending?: PendingFlush;

  constructor(private readonly flush: (snapshot: Record<string, any>) => Promise<void>) {}

  public write(snapshot: Record<string, any>): Promise<void> {
    if (!this.#inFlight) {
      this.#inFlight = this.#run(snapshot);
      return this.#inFlight;
    }

    if (this.#pending) {
      this.#pending.snapshot = snapshot;
      return this.#pending.promise;
    }

    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.#pending = { snapshot, promise, resolve, reject };
    return promise;
  }

  public async idle(): Promise<void> {
    while (this.#inFlight) {
      await this.#inFlight.catch(() => {});
    }
  }

  async #run(snapshot: Record<string, any>): Promise<void> {
    try {
      await this.flush(snapshot);
    } finally {
      const pending = this.#pending;
      this.#pending = undefined;

      if (pending) {
        this.#inFlight = this.#run(pending.snapshot);
        this.#inFlight.then(pending.resolve, pending.reject);
      } else {
        this.#inFlight = undefined;
      }
    }
  }
}
