import type { Promisify } from '@camera.ui/rpc';

function byteSize(data: unknown): number {
  return ArrayBuffer.isView(data) || data instanceof ArrayBuffer ? data.byteLength : 0;
}

export function frameArgBytes(arg: unknown): number {
  if (Array.isArray(arg)) {
    let total = 0;
    for (const item of arg) total += byteSize((item as { data?: unknown } | undefined)?.data);
    return total;
  }
  return byteSize((arg as { data?: unknown } | undefined)?.data);
}

export function withFrameBytes<T extends object>(proxy: Promisify<T>, onBytes: (bytes: number) => void): Promisify<T> {
  return new Proxy(proxy, {
    get: (target, property) => {
      const member: unknown = Reflect.get(target, property);
      if (typeof property === 'symbol' || typeof member !== 'function') return member;

      return (...args: unknown[]) => {
        const bytes = frameArgBytes(args[0]);
        if (bytes > 0) onBytes(bytes);
        return Reflect.apply(member, target, args);
      };
    },
  });
}
