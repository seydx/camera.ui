import type { PowerResumeReason } from '@/types/electron.js';

export const WAKE_EVENT = 'wake';
export const UNLOCK_EVENT = 'unlock';

export function createWakeSource(): EventTarget | undefined {
  const electron = typeof window !== 'undefined' ? window.electron : undefined;
  if (!electron) return undefined;
  const source = new EventTarget();
  try {
    electron.on('power-resume', (_event, reason?: PowerResumeReason) => source.dispatchEvent(new Event(reason === 'unlock' ? UNLOCK_EVENT : WAKE_EVENT)));
  } catch {
    // older desktop builds refuse unknown channels
    return undefined;
  }
  return source;
}
