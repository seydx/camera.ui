import { killTree } from '@camera.ui/common/node';
import { IS_DEV } from '@camera.ui/common/utils';
import { execSync } from 'node:child_process';

import type { Job } from '@seydx/win-job';
import type { ConfigService } from '../services/config/index.js';

export const DETACHED_IN_DEV = IS_DEV && process.platform !== 'win32';

let processTree: Job | undefined;

export async function holdProcessTree(): Promise<void> {
  if (process.platform !== 'win32' || processTree) {
    return;
  }

  let job: Job | undefined;
  try {
    const winJob = await import('@seydx/win-job');
    job = new winJob.Job({ killOnClose: true });
    job.assign(process.pid);
    processTree = job;
  } catch (error) {
    job?.close();
    console.warn(`Child processes may outlive camera.ui: ${error instanceof Error ? error.message : error}`);
  }
}

export async function killLeftovers(configService: ConfigService): Promise<void> {
  await Promise.allSettled(configService.processes.map((entry) => killTree(entry)));
}

export function reapTrackedProcessesOnExit(configService: ConfigService): void {
  process.on('exit', () => {
    for (const proc of configService.processes) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore', windowsHide: true });
        } else {
          process.kill(proc.pgid ? -proc.pgid : proc.pid, 'SIGKILL');
        }
      } catch {
        // already gone
      }
    }
  });
}
