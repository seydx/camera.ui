import { Worker } from 'node:worker_threads';

import { LEASE_STOP_GRACE_MS } from './timing.js';

export interface WatchedGroup {
  pid: number;
  pgid?: number;
}

type WatchdogMessage = { type: 'arm'; fenceAt: number; graceMs: number; groups: WatchedGroup[] } | { type: 'disarm' };

const WATCHDOG_SOURCE = `
const { parentPort } = require('node:worker_threads');
const { execFileSync } = require('node:child_process');
let timer;

function killGroup(group) {
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/F', '/T', '/PID', String(group.pid)], { stdio: 'ignore', windowsHide: true });
    } else if (group.pgid && group.pgid > 1) {
      process.kill(-group.pgid, 'SIGKILL');
    } else {
      process.kill(group.pid, 'SIGKILL');
    }
  } catch {}
}

parentPort.on('message', (message) => {
  clearTimeout(timer);
  if (message.type !== 'arm') return;
  timer = setTimeout(() => {
    message.groups.forEach(killGroup);
    parentPort.postMessage({ type: 'fired', pids: message.groups.map((group) => group.pid) });
  }, Math.max(0, message.fenceAt + message.graceMs - Date.now()));
});
`;

export class LeaseWatchdog {
  private worker?: Worker;

  constructor(private onFired: (pids: number[]) => void) {}

  public arm(fenceAt: number, groups: WatchedGroup[], graceMs = LEASE_STOP_GRACE_MS): void {
    this.post({ type: 'arm', fenceAt, graceMs, groups });
  }

  public disarm(): void {
    if (this.worker) {
      this.post({ type: 'disarm' });
    }
  }

  public async close(): Promise<void> {
    const worker = this.worker;
    this.worker = undefined;
    await worker?.terminate();
  }

  private post(message: WatchdogMessage): void {
    if (!this.worker) {
      this.worker = new Worker(WATCHDOG_SOURCE, { eval: true });
      this.worker.unref();
      this.worker.on('message', (reply: { type: 'fired'; pids: number[] }) => this.onFired(reply.pids));
    }
    this.worker.postMessage(message);
  }
}
