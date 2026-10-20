import type { TraceRead } from './types.js';

export function isShownRead(read: TraceRead): boolean {
  return !read.empty && !read.failed && (read.single === true || read.reads !== undefined);
}
