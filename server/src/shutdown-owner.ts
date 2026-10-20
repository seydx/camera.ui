import { LEGACY_SUPERVISOR_BUDGET_MS, SUPERVISOR_IPC_ENV, SUPERVISOR_IPC_LEVEL } from '@camera.ui/common/node';
import { SignalHandler } from '@camera.ui/common/utils';

import { REPORT_DIR, WITH_REPORTS } from './utils/crash.js';

import type { ShutdownReason, SupervisorRolledBackMessage, SupervisorShutdownMessage } from '@camera.ui/common/node';
import type { LoggerService } from './services/logger/index.js';

const SUPERVISOR_RESERVE_MS = 2000;
const MIN_BUDGET_MS = 1000;

export const SUPERVISED = Number(process.env[SUPERVISOR_IPC_ENV] ?? 0) >= SUPERVISOR_IPC_LEVEL;

export class ShutdownOwner {
  private signalHandler: SignalHandler;
  private shutdownReason: ShutdownReason = 'unknown';
  private budgetMs = LEGACY_SUPERVISOR_BUDGET_MS;

  constructor(
    private logger: LoggerService,
    close: () => Promise<void>,
  ) {
    this.signalHandler = new SignalHandler({
      displayName: '[Signal]',
      timeoutDuration: this.budgetMs,
      logger,
      reportErrors: WITH_REPORTS,
      reportDirectory: REPORT_DIR,
      ignoreSIGINT: SUPERVISED,
      closeFunction: close,
    });

    process.on('message', (message: SupervisorShutdownMessage | SupervisorRolledBackMessage) => this.onSupervisorMessage(message));
    if (process.send) {
      process.on('disconnect', () => {
        this.logger.warn('Lost the connection to the supervisor, stopping');
        this.shutdown('stop');
      });
    }
  }

  public get reason(): ShutdownReason {
    return this.shutdownReason;
  }

  public get budget(): number {
    return this.budgetMs;
  }

  public get closing(): boolean {
    return this.signalHandler.closing;
  }

  public shutdown(reason: ShutdownReason, budgetMs = this.budgetMs): Promise<void> {
    if (!this.signalHandler.closing) {
      this.shutdownReason = reason;
      this.budgetMs = budgetMs;
      this.signalHandler.setTimeoutDuration(budgetMs);
    }
    return this.signalHandler.close(reason);
  }

  public crash(): Promise<void> {
    process.exitCode = 1;
    return this.shutdown('unknown');
  }

  private onSupervisorMessage(message: SupervisorShutdownMessage | SupervisorRolledBackMessage): void {
    switch (message?.type) {
      case 'SHUTDOWN':
        this.shutdown(message.reason, Math.max(MIN_BUDGET_MS, message.deadlineMs - SUPERVISOR_RESERVE_MS));
        break;
      case 'ROLLED_BACK':
        this.logger.warn(`The update to ${message.from} did not start, back on ${message.to}: ${message.reason}`);
        break;
    }
  }
}
