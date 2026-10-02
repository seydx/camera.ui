import { AV_LOG_ERROR } from 'node-av/constants';
import { Log } from 'node-av/lib';

export interface NodeAvLogTarget {
  trace(...args: any[]): void;
}

const REPEAT_SUMMARY_INTERVAL = 30_000;

let configured = false;

export function setupNodeAvLog(logger: NodeAvLogTarget): void {
  if (configured) {
    return;
  }
  configured = true;

  let lastMessage: string | undefined;
  let repeats = 0;
  let summaryTimer: NodeJS.Timeout | undefined;

  function flushRepeats(): void {
    clearTimeout(summaryTimer);
    summaryTimer = undefined;
    if (repeats > 0) {
      logger.trace(`[node-av] Last message repeated ${repeats} times`);
      repeats = 0;
    }
  }

  Log.setCallback(
    (_, message) => {
      if (message === lastMessage) {
        repeats++;
        summaryTimer ??= setTimeout(flushRepeats, REPEAT_SUMMARY_INTERVAL).unref();
        return;
      }

      flushRepeats();
      lastMessage = message;
      logger.trace(`[node-av] ${message}`);
    },
    { maxLevel: AV_LOG_ERROR },
  );
}
