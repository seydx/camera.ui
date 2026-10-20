import { APP_SERVER_NAME } from '@camera.ui/common/utils';
import { PROTOCOL_LEVEL } from '@camera.ui/sdk';
import semver from 'semver';

import { getPackument } from './npm/index.js';
import { fetchVersionManifest, resolveManifest } from './npm/registry.js';

import type { EngineIssue, ProtocolCompat } from '../api/types/index.js';
import type { WorkerProtocolRange } from '../workers/lifecycle/update.js';

export const MIN_SUPPORTED_PROTOCOL_LEVEL = 1;

export function checkProtocolCompat(protocolLevel: unknown): ProtocolCompat {
  if (typeof protocolLevel !== 'number') return 'unknown';
  if (protocolLevel < MIN_SUPPORTED_PROTOCOL_LEVEL) return 'pluginTooOld';
  if (protocolLevel > PROTOCOL_LEVEL) return 'serverTooOld';
  return 'compatible';
}

export function checkEngineCompatibility(engines: Record<string, string> | undefined, hostVersion: string, nodeVersion: string): EngineIssue[] {
  if (!engines) {
    return [];
  }

  const issues: EngineIssue[] = [];

  const checks: { engine: EngineIssue['engine']; current: string }[] = [
    { engine: 'camera.ui', current: hostVersion },
    { engine: 'node', current: nodeVersion.replace(/^v/, '') },
  ];

  for (const { engine, current } of checks) {
    const required = engines[engine];

    if (!required || !semver.validRange(required, { loose: true })) {
      continue;
    }

    const coerced = semver.coerce(current);

    if (coerced && !semver.satisfies(coerced.version, required, { loose: true })) {
      issues.push({ engine, required, current });
    }
  }

  return issues;
}

export async function serverNodeIssue(version: string, nodeVersion = process.version): Promise<EngineIssue | undefined> {
  try {
    const manifest = resolveManifest(await getPackument(APP_SERVER_NAME), `${APP_SERVER_NAME}@${version}`, version);
    return checkEngineCompatibility(manifest.engines, manifest.version, nodeVersion).find((issue) => issue.engine === 'node');
  } catch {
    return undefined;
  }
}

export async function serverTarget(spec: string): Promise<{ version: string; workerProtocol?: WorkerProtocolRange } | undefined> {
  try {
    const manifest = await fetchVersionManifest(APP_SERVER_NAME, spec);
    const range = manifest.cameraui?.workerProtocol;
    const workerProtocol = typeof range?.level === 'number' && typeof range.min === 'number' ? { level: range.level, min: range.min } : undefined;
    return { version: manifest.version, workerProtocol };
  } catch {
    return undefined;
  }
}
