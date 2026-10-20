const REGISTERED = /Registered tunnel connection\b.*?\bconnIndex=(\d+)/;
const UNREGISTERED = /(?:Unregistered tunnel connection|Serve tunnel error|Lost connection with the edge|Connection terminated)\b.*?\bconnIndex=(\d+)/;

interface Waiter {
  settle: (registered: boolean) => void;
  untilExit: boolean;
}

export class TunnelConnections {
  private connections = new Set<string>();
  private waiters = new Set<Waiter>();

  public get count(): number {
    return this.connections.size;
  }

  public get registered(): boolean {
    return this.connections.size > 0;
  }

  public observe(line: string): void {
    const up = REGISTERED.exec(line);
    if (up) {
      this.connections.add(up[1]);
      for (const waiter of [...this.waiters]) waiter.settle(true);
      return;
    }

    const down = UNREGISTERED.exec(line);
    if (down) this.connections.delete(down[1]);
  }

  public reset(): void {
    // waiters keep their own deadline, a restart in between is normal
    this.connections.clear();
  }

  public exited(): void {
    this.connections.clear();
    for (const waiter of [...this.waiters]) {
      if (waiter.untilExit) waiter.settle(false);
    }
  }

  public whenRegistered(timeoutMs: number, untilExit = false): Promise<boolean> {
    if (this.registered) return Promise.resolve(true);

    return new Promise((resolve) => {
      const waiter: Waiter = {
        settle: (value) => {
          clearTimeout(timer);
          this.waiters.delete(waiter);
          resolve(value);
        },
        untilExit,
      };
      const timer = setTimeout(() => waiter.settle(this.registered), timeoutMs);
      timer.unref();
      this.waiters.add(waiter);
    });
  }
}
