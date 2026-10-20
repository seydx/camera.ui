import { Logger } from '@camera.ui/common';
import { createWriteStream, existsSync, ftruncate, read } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

import { printSymbol } from './spinner.js';

import type { WriteStream } from 'node:fs';

const truncatePromise = promisify(ftruncate);
const readPromise = promisify(read);

export class CLILogger {
  private truncateInterval?: NodeJS.Timeout;
  private truncateIntervalMs: number = 1000 * 60 * 60 * 2;

  private logger: Logger;
  private fileStream?: WriteStream;

  constructor(
    private logPath: string,
    private action = '',
  ) {
    this.logger = new Logger({ prefix: 'camera.ui', suffix: 'CLI', debugEnabled: true, traceEnabled: true });
  }

  public init(): void {
    this.fileStream = createWriteStream(this.logPath, { flags: 'a' });

    this.logger.onLog((entry) => {
      if (this.fileStream?.writable) {
        const text = Logger.formatAsText(entry);
        this.fileStream.write(text + '\n');
      }
    });

    this.truncateInterval = setInterval(() => this.truncateLog(), this.truncateIntervalMs);
    this.truncateLog();
  }

  public log(msg: string, level: 'info' | 'succeed' | 'fail' | 'warn' | 'debug' | 'raw' = 'info', write?: boolean): void {
    if (this.action === 'run' || write) {
      if (level === 'raw') {
        // server output, its FileTransport already writes it to the same file
        console.log(msg);
      } else {
        const loggingLevel = this.getLoggingLevel(level);
        this.logger[loggingLevel](msg);
      }
    } else {
      printSymbol(level === 'debug' || level === 'raw' ? 'info' : level, msg);
    }
  }

  public close(): void {
    clearInterval(this.truncateInterval);
    this.fileStream?.end();
    this.fileStream = undefined;
  }

  private async truncateLog(): Promise<void> {
    if (!existsSync(this.logPath)) {
      return;
    }

    const maxSize = 1000000;
    const truncateSize = 200000;

    try {
      const logStats = await stat(this.logPath);

      if (logStats.size < maxSize) {
        this.log(`Log file size is less than ${maxSize} bytes, skipping truncate`, 'debug');
        return;
      }

      this.log(`Truncating log file to ${truncateSize} bytes...`, 'debug');

      const logStartPosition = logStats.size - truncateSize;
      const logBuffer = Buffer.alloc(truncateSize);
      const fileHandle = await open(this.logPath, 'r+');

      try {
        await readPromise(fileHandle.fd, logBuffer, 0, truncateSize, logStartPosition);
        await truncatePromise(fileHandle.fd, 0);
        await fileHandle.write(logBuffer, 0, truncateSize, 0);
      } finally {
        await fileHandle.close();
      }

      this.log('Log file truncated successfully', 'debug');
    } catch (e) {
      this.log(`Failed to truncate log file: ${e.message}`, 'fail');
    }
  }

  private getLoggingLevel(level: 'info' | 'succeed' | 'fail' | 'warn' | 'debug' | 'raw'): 'log' | 'warn' | 'error' | 'success' | 'debug' | 'raw' {
    switch (level) {
      case 'info':
        return 'log';
      case 'succeed':
        return 'success';
      case 'fail':
        return 'error';
      case 'warn':
        return 'warn';
      case 'debug':
        return 'debug';
      case 'raw':
        return 'raw';
      default:
        return 'log';
    }
  }
}
