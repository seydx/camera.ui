import { isNoRespondersError } from '@camera.ui/rpc';

import type { Promisify } from '@camera.ui/rpc';

const MIN_PAUSE_MS = 250;
const MAX_PAUSE_MS = 1000;

export function withNoResponderBackoff<T extends object>(proxy: Promisify<T>): Promisify<T> {
  let awaySince: number | undefined;
  let pausedUntil = 0;
  let generation = 0;

  return new Proxy(proxy, {
    get: (target, property) => {
      const member: unknown = Reflect.get(target, property);
      if (typeof property === 'symbol' || typeof member !== 'function') return member;

      return async (...args: unknown[]) => {
        if (Date.now() < pausedUntil) {
          throw new Error(`no responders: ${property} paused while the detector is away`);
        }

        // calls that were already out when a failure was counted must not count again
        const startedIn = generation;
        try {
          const result = await Reflect.apply(member, target, args);
          awaySince = undefined;
          pausedUntil = 0;
          return result;
        } catch (error) {
          if (isNoRespondersError(error) && startedIn === generation) {
            generation++;
            const now = Date.now();
            awaySince ??= now;
            pausedUntil = now + Math.min(MAX_PAUSE_MS, Math.max(MIN_PAUSE_MS, (now - awaySince) / 2));
          }
          throw error;
        }
      };
    },
  });
}
