import { statfsSync } from 'node:fs';

// old and new install sit side by side until the swap, 1.5 to 2 GB
const SERVER_UPDATE_FREE_BYTES = 2 * 1024 ** 3;

export class DiskSpaceError extends Error {
  public readonly statusCode = 409;
}

export function assertServerUpdateSpace(homePath: string): void {
  const free = freeBytes(homePath);
  if (free !== undefined && free < SERVER_UPDATE_FREE_BYTES) {
    throw new DiskSpaceError(`Not enough free disk space for the server update: ${gigabytes(free)} GB free, ${gigabytes(SERVER_UPDATE_FREE_BYTES)} GB needed`);
  }
}

function freeBytes(path: string): number | undefined {
  try {
    const stats = statfsSync(path);
    return stats.bavail * stats.bsize;
  } catch {
    // unknown, npm reports it if it runs out
    return undefined;
  }
}

function gigabytes(bytes: number): number {
  return Math.round((bytes / 1024 ** 3) * 10) / 10;
}
