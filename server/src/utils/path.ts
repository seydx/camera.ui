import { IS_DEV, IS_ELECTRON } from '@camera.ui/common/utils';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ELECTRON_ASAR_UNPACKED } from '../services/config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JS_EXT = IS_DEV && !IS_ELECTRON ? 'ts' : 'js';

export const pythonPath = resolve(join(__dirname, '..')).replace('app.asar', ELECTRON_ASAR_UNPACKED);

export const serverRequirementsPath = resolve(join(__dirname, '..', '..', 'requirements.txt')).replace('app.asar', ELECTRON_ASAR_UNPACKED);

export const pythonPluginPath = resolve(join(__dirname, '..', 'plugins', 'runtime', 'python', 'child.py')).replace('app.asar', ELECTRON_ASAR_UNPACKED);

export const nodeDecoderPath = resolve(join(__dirname, '..', 'camera', 'decoder', `child.${JS_EXT}`)).replace('app.asar', ELECTRON_ASAR_UNPACKED);
export const nodePluginPath = resolve(join(__dirname, '..', 'plugins', 'runtime', 'node', `child.${JS_EXT}`)).replace('app.asar', ELECTRON_ASAR_UNPACKED);
export const restoreSummaryPath = resolve(join(__dirname, '..', 'services', 'config', `restore-summary.${JS_EXT}`)).replace('app.asar', ELECTRON_ASAR_UNPACKED);

const shortPathCache = new Map<string, string>();

export function execSafePath(filePath: string): string {
  if (platform() !== 'win32' || !filePath.includes(' ')) {
    return filePath;
  }

  const cached = shortPathCache.get(filePath);
  if (cached !== undefined) {
    return cached;
  }

  let safePath = filePath;

  if (!filePath.includes('%') && !filePath.includes('"')) {
    try {
      const shortPath = execSync('for %I in ("%CUI_LONG_PATH%") do @echo %~sI', {
        env: { ...process.env, CUI_LONG_PATH: filePath },
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (shortPath && !shortPath.includes(' ') && existsSync(shortPath)) {
        safePath = shortPath;
      }
    } catch {
      // ignore
    }
  }

  shortPathCache.set(filePath, safePath);

  return safePath;
}
