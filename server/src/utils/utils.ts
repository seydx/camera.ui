import { createHash, timingSafeEqual } from 'node:crypto';

export function streamTokenMatches(given: unknown, expected: string): boolean {
  if (typeof given !== 'string' || !given) {
    return false;
  }
  return timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());
}
