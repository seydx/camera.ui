import { createInterface } from 'node:readline';

import type { SignalHandler } from '@camera.ui/common/utils';

export const HOST_PROTOCOL = 2;
export const HANDSHAKE_LEVEL = 2;
export const HOST_PROTOCOL_ENV = 'CAMERAUI_HOST_PROTOCOL';
export const INSTANCE_ID_ENV = 'CAMERAUI_INSTANCE_ID';
export const STOP_BUDGET_ENV = 'CAMERAUI_STOP_BUDGET_MS';

export function hostSpeaksStopLine(): boolean {
  return Number(process.env[HOST_PROTOCOL_ENV] ?? 0) >= HOST_PROTOCOL;
}

export function hostStopBudget(fallbackMs: number): number {
  const budget = Number(process.env[STOP_BUDGET_ENV]);
  return hostSpeaksStopLine() && budget > 0 ? budget : fallbackMs;
}

export function parseStopLine(line: string): number | undefined {
  try {
    const budgetMs = JSON.parse(line)?.stop?.budgetMs;
    return typeof budgetMs === 'number' && budgetMs > 0 ? budgetMs : undefined;
  } catch {
    return undefined;
  }
}

export function listenForHostStop(signalHandler: SignalHandler): void {
  if (!hostSpeaksStopLine()) {
    return;
  }

  const lines = createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    const budgetMs = parseStopLine(line);
    if (budgetMs === undefined) {
      return;
    }
    signalHandler.setTimeoutDuration(budgetMs);
    signalHandler.close('stop request from the host');
  });
  lines.on('close', () => signalHandler.close('host closed stdin'));
  process.on('disconnect', () => signalHandler.close('host disconnected'));
}
