import { reapRegistry } from '@camera.ui/common/node';
import { open } from 'lmdb';
import { constants, existsSync } from 'node:fs';
import { access, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { container } from 'tsyringe';

import { inject } from '../../container.js';

import type { PidRegistryEntry, ReapResult } from '@camera.ui/common/node';

export interface PathExistenceResult {
  path: string;
  exists: boolean;
}

export interface PathPermissionsResult {
  path: string;
  hasPermissions: boolean;
  error?: Error;
}

export interface CleanedUpFilesResult {
  path: string;
  wasCleaned: boolean;
  error?: Error;
}

export interface DatabaseCorruptionResult {
  dbPath: string;
  isCorrupt: boolean;
  error?: Error;
}

export interface PortAvailabilityResult {
  port: number;
  isAvailable: boolean;
}

export interface OrphanedProcessesResult {
  processInfo: PidRegistryEntry;
  killed?: boolean;
  wasOrphaned?: boolean;
  error?: Error;
}

export interface PathPermission {
  path: string;
  mode: number;
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      server.close();
      resolve(err.code !== 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

export async function checkPathsExist(pathsToCheck: string[]): Promise<PathExistenceResult[]> {
  const results: PathExistenceResult[] = [];

  for (const path of pathsToCheck) {
    const exists = existsSync(path);
    results.push({ path, exists });
  }

  return results;
}

export async function checkPathPermissions(pathsWithPermissionsToCheck: PathPermission[]): Promise<PathPermissionsResult[]> {
  const results: PathPermissionsResult[] = [];

  for (const { path, mode } of pathsWithPermissionsToCheck) {
    try {
      await access(path, mode);
      results.push({ path, hasPermissions: true });
    } catch (err) {
      results.push({ path, hasPermissions: false, error: err as Error });
    }
  }

  return results;
}

export async function cleanUpFiles(filesToClean: string[]): Promise<CleanedUpFilesResult[]> {
  const cleanedFiles: CleanedUpFilesResult[] = [];

  for (const file of filesToClean) {
    try {
      await access(file, constants.W_OK);
      await unlink(file);

      cleanedFiles.push({ path: file, wasCleaned: true });
    } catch (err) {
      cleanedFiles.push({ path: file, wasCleaned: false, error: err as Error });
    }
  }

  return cleanedFiles;
}

export async function checkDatabaseCorruption(dbPath: string): Promise<DatabaseCorruptionResult> {
  try {
    const db = open({
      path: dbPath,
      readOnly: true,
    });

    await db.get('test_key');
    await db.close();

    return { dbPath, isCorrupt: false };
  } catch (err) {
    return { dbPath, isCorrupt: true, error: err as Error };
  }
}

export async function checkPortAvailability(portsToCheck: number[]): Promise<PortAvailabilityResult[]> {
  const results: PortAvailabilityResult[] = [];

  for (const port of portsToCheck) {
    const isAvailable = await isPortAvailable(port);
    results.push({ port, isAvailable });
  }

  return results;
}

export async function checkOrphanedProcesses(entries: PidRegistryEntry[]): Promise<OrphanedProcessesResult[]> {
  const configService = inject('configService');

  let reaped: ReapResult[];
  try {
    reaped = await reapRegistry(entries);
  } catch (error) {
    return entries.map((processInfo) => ({ processInfo, error: error as Error }));
  }

  return reaped.map(({ entry, outcome, error }) => {
    if (outcome !== 'failed') {
      configService.removeProcessByPID(entry.pid);
    }

    const wasOrphaned = outcome === 'killed' || outcome === 'failed';
    return { processInfo: entry, wasOrphaned, killed: wasOrphaned ? outcome === 'killed' : undefined, error };
  });
}
