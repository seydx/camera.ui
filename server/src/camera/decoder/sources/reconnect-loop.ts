import { ReconnectBackoff } from '../reconnect-backoff.js';

import type { Logger } from '@camera.ui/common/logger';

export interface CycleOutcome {
  delivered: boolean;
  error?: Error;
}

export class ReconnectLoop {
  private readonly backoff = new ReconnectBackoff();
  private sleepTimer?: NodeJS.Timeout;
  private sleepResolve?: () => void;
  private abort = new AbortController();

  constructor(
    private readonly logger: Logger,
    private readonly label: string,
  ) {}

  public get signal(): AbortSignal {
    return this.abort.signal;
  }

  public async run(shouldRun: () => boolean, cycle: () => Promise<CycleOutcome>): Promise<void> {
    this.backoff.reset();
    this.abort = new AbortController();

    while (shouldRun()) {
      let outcome: CycleOutcome;
      try {
        outcome = await cycle();
      } catch (error) {
        outcome = { delivered: false, error: error instanceof Error ? error : new Error(String(error)) };
      }

      if (!shouldRun()) break;

      if (outcome.error) {
        const delay = this.backoff.nextDelayMs();
        this.logger.warn(`${this.label} error, reconnecting in ${delay / 1000}s: ${outcome.error.message}`);
        await this.sleep(delay);
      } else if (!outcome.delivered) {
        this.logger.debug(`${this.label} ended without data, waiting before reconnect...`);
        await this.sleep(this.backoff.idleDelayMs);
      } else {
        const delay = this.backoff.nextDelayMs();
        this.logger.debug(`${this.label} disconnected, reconnecting in ${delay / 1000}s...`);
        await this.sleep(delay);
      }
    }
  }

  public connected(): void {
    this.backoff.reset();
  }

  public retryNow(): void {
    this.backoff.reset();
    this.wake();
  }

  public cancel(): void {
    this.abort.abort();
    this.wake();
  }

  public wake(): void {
    clearTimeout(this.sleepTimer);
    this.sleepTimer = undefined;
    this.sleepResolve?.();
    this.sleepResolve = undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sleepResolve = resolve;
      this.sleepTimer = setTimeout(() => {
        this.sleepResolve = undefined;
        resolve();
      }, ms);
    });
  }
}
