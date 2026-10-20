import { WINDOW_CAP } from './detection-window.js';

const MAX_FREE_PER_KEY = WINDOW_CAP;
const MAX_KEYS = 4;

export class OutputPool {
  private readonly free = new Map<string, Buffer[]>();

  public lease(): OutputLease {
    return new OutputLease(this);
  }

  public take(key: string, bytes: number, fill?: number): Buffer {
    const reused = this.free.get(key)?.pop();
    if (reused) return reused;

    const buffer = Buffer.allocUnsafeSlow(bytes);
    if (fill !== undefined) buffer.fill(fill);
    return buffer;
  }

  public give(key: string, buffer: Buffer): void {
    const list = this.free.get(key) ?? [];
    this.free.delete(key);
    this.free.set(key, list);
    if (this.free.size > MAX_KEYS) this.free.delete(this.free.keys().next().value!);
    if (list.length < MAX_FREE_PER_KEY) list.push(buffer);
  }

  public clear(): void {
    this.free.clear();
  }
}

export class OutputLease {
  private taken: { key: string; buffer: Buffer }[] = [];

  constructor(private readonly pool: OutputPool) {}

  public take(key: string, bytes: number, fill?: number): Buffer {
    const buffer = this.pool.take(key, bytes, fill);
    this.taken.push({ key, buffer });
    return buffer;
  }

  public async releaseAfter<T>(calls: Promise<T>): Promise<T> {
    const result = await calls;
    this.release();
    return result;
  }

  public release(): void {
    for (const { key, buffer } of this.taken) this.pool.give(key, buffer);
    this.taken = [];
  }
}
