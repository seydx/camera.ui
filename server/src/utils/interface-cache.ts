import { ensureDir, outputFile, pathExists, readJson, remove, writeJson } from 'fs-extra/esm';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, utimes } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import type { Stats } from 'node:fs';

interface ReleaseEntry {
  version: string;
  timestamp: number;
  files: string[];
  sources?: Record<string, string>;
}

const RELEASES_FILE = '.cui-releases.json';
const RETAINED_RELEASES = 2;
const MTIME_BASE = Date.UTC(2020, 0, 1);
const MTIME_SPAN = 2 ** 37;

export async function syncInterfaceCache(sourceDir: string, cacheDir: string, version: string): Promise<void> {
  try {
    if (!(await pathExists(sourceDir))) {
      return;
    }

    await ensureDir(cacheDir);

    const sourceFiles = await walkFiles(sourceDir);
    const cacheFiles = await walkFiles(cacheDir);
    const releases = await readReleases(cacheDir);
    const stored = JSON.stringify(releases);
    const newest = releases[releases.length - 1];
    const current = newest?.version === version ? newest : undefined;
    const verified = current?.sources ?? {};
    const sources: Record<string, string> = {};

    for (const rel of sourceFiles) {
      const source = join(sourceDir, ...rel.split('/'));
      const dest = join(cacheDir, ...rel.split('/'));
      const [from, to] = await Promise.all([stat(source), stat(dest).catch(() => undefined)]);

      if (rel.startsWith('assets/')) {
        // names under assets/ carry the content hash
        if (to?.size === from.size) continue;
      } else {
        sources[rel] = fingerprint(from);
        if (to?.size === from.size && (verified[rel] === sources[rel] || (await sameContent(source, dest)))) continue;
      }

      await copyStable(source, dest);
    }

    if (current) {
      releases.pop();
    }
    for (const entry of releases) {
      delete entry.sources;
    }
    releases.push({ version, timestamp: current?.timestamp ?? Date.now(), files: sourceFiles, sources });

    const retained = releases.slice(-RETAINED_RELEASES);
    // without an earlier release on record, the files open tabs still load are unknown
    if (retained.some((entry) => entry.version !== version)) {
      const keep = new Set(retained.flatMap((entry) => entry.files));
      for (const rel of cacheFiles) {
        if (rel !== RELEASES_FILE && !keep.has(rel)) {
          await remove(join(cacheDir, ...rel.split('/')));
        }
      }
    }

    if (JSON.stringify(retained) !== stored) {
      await writeReleases(cacheDir, retained);
    }
  } catch {
    // ignore
  }
}

async function walkFiles(dir: string, base: string = dir): Promise<string[]> {
  if (!(await pathExists(dir))) {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full, base)));
    } else if (entry.isFile()) {
      files.push(relative(base, full).split(sep).join('/'));
    }
  }

  return files;
}

function fingerprint(stats: Stats): string {
  return `${stats.ino}:${stats.size}:${stats.mtimeMs}:${stats.ctimeMs}`;
}

async function sameContent(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([readFile(a), readFile(b)]);
  return left.equals(right);
}

async function copyStable(source: string, dest: string): Promise<void> {
  const data = await readFile(source);
  const offset = createHash('sha256').update(data).digest().readUIntBE(0, 6) % MTIME_SPAN;
  const mtime = new Date(MTIME_BASE + offset);
  await outputFile(dest, data);
  await utimes(dest, mtime, mtime);
}

async function readReleases(cacheDir: string): Promise<ReleaseEntry[]> {
  const file = join(cacheDir, RELEASES_FILE);
  if (!(await pathExists(file))) {
    return [];
  }

  try {
    const data = await readJson(file);
    return Array.isArray(data) && data.every(isReleaseEntry) ? data : [];
  } catch {
    return [];
  }
}

function isReleaseEntry(value: unknown): value is ReleaseEntry {
  const entry = value as ReleaseEntry | null;
  return typeof entry?.version === 'string' && Array.isArray(entry.files);
}

async function writeReleases(cacheDir: string, releases: ReleaseEntry[]): Promise<void> {
  await writeJson(join(cacheDir, RELEASES_FILE), releases, { spaces: 2 });
}
