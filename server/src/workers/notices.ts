import { Severity } from '@camera.ui/sdk';

import { inject } from '../container.js';
import { SystemNotificationTypeId } from '../manager/types.js';

// a short network drop is over before anyone could act on it
const OFFLINE_CONFIRM_MS = 120_000;
const BACK_STABLE_MS = 60_000;

const LOST_REASONS: Record<string, string> = {
  'no heartbeat': 'stopped answering',
  'did not connect': 'did not connect after camera.ui started',
  'lease fenced': 'gets no answers from the main server',
  'did not come back after the restart': 'did not come back after a restart',
};

interface Workloads {
  moved: number;
  waiting: number;
}

interface Notice {
  notified: boolean;
  timer?: NodeJS.Timeout;
}

export class WorkerNotices {
  private notices = new Map<string, Notice>();

  private get notificationManager() {
    return inject('proxy').notificationManager;
  }

  public lost(agentId: string, name: string, reason: string, workloads: Workloads): void {
    const notice = this.notices.get(agentId);
    clearTimeout(notice?.timer);
    if (notice?.notified) {
      // the same outage, its back push is off
      notice.timer = undefined;
      return;
    }
    if (workloads.moved + workloads.waiting === 0) {
      this.notices.delete(agentId);
      return;
    }

    const timer = setTimeout(() => this.fireLost(agentId, name, reason, workloads), OFFLINE_CONFIRM_MS);
    this.notices.set(agentId, { notified: false, timer });
  }

  public online(agentId: string, name: string): void {
    const notice = this.notices.get(agentId);
    if (!notice) return;
    clearTimeout(notice.timer);
    if (!notice.notified) {
      this.notices.delete(agentId);
      return;
    }

    notice.timer = setTimeout(() => {
      this.notices.delete(agentId);
      this.notify(agentId, 'online', 'Worker back online', `${name} is online again.`, Severity.Info);
    }, BACK_STABLE_MS);
  }

  public forget(agentId: string): void {
    clearTimeout(this.notices.get(agentId)?.timer);
    this.notices.delete(agentId);
  }

  public clear(): void {
    for (const agentId of this.notices.keys()) this.forget(agentId);
  }

  private fireLost(agentId: string, name: string, reason: string, { moved, waiting }: Workloads): void {
    const notice = this.notices.get(agentId);
    if (!notice) return;
    notice.notified = true;
    notice.timer = undefined;

    const where =
      waiting === 0
        ? 'Its cameras and plugins run on the main server until it is back.'
        : moved === 0
          ? 'Its cameras and plugins wait for it.'
          : 'Some of its cameras and plugins run on the main server, the rest wait for it.';
    this.notify(agentId, 'offline', 'Worker offline', `${name} ${LOST_REASONS[reason] ?? reason}. ${where}`, Severity.Warn);
  }

  private notify(agentId: string, state: 'offline' | 'online', title: string, body: string, severity: Severity): void {
    this.notificationManager
      .notify({
        source: { kind: 'system', id: SystemNotificationTypeId.WorkerOffline },
        notification: {
          title,
          body,
          severity,
          tag: `${SystemNotificationTypeId.WorkerOffline}:${state}:${agentId}`,
          deepLink: '/workers',
          adminOnly: true,
        },
      })
      .catch(() => {});
  }
}
