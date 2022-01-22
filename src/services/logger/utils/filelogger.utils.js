'use-strict';

import path from 'path';
import fs from 'fs-extra';

export default class FileLogger {
  defaultOptions = {
    path: path.resolve(),
    fileName: 'log.txt',
    logFileMaxSize: 3000000, // ~3 MB
    truncateSize: 2000000, // ~2 MB
  };

  options = null;
  stream = null;

  constructor(loggerOptions = {}) {
    this.options = {
      ...this.defaultOptions,
      ...loggerOptions,
    };

    if (!fs.existsSync(this.options.path) && !this.#createLogDirectory()) {
      throw new Error('Cannot create log dir');
    }

    this.logPath = path.resolve(this.options.path, this.options.fileName);
    this.stream = fs.createWriteStream(this.logPath, { flags: 'a' });
  }

  log(data) {
    this.#toFile(data);
  }

  end() {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }

  async truncateFile() {
    if (!(await fs.pathExists(this.logPath))) {
      return;
    }

    const logStats = await fs.stat(this.logPath);

    if (logStats.size < this.options.logFileMaxSize) {
      return; // log file does not need truncating
    }

    // read out the last `truncatedSize` bytes to a buffer
    const logStartPosition = logStats.size - this.options.truncateSize;
    const logBuffer = Buffer.alloc(this.options.truncateSize);
    const logFileHandle = await fs.open(this.logPath, 'a+');
    await fs.read(logFileHandle, logBuffer, 0, this.options.truncateSize, logStartPosition);

    // truncate the existing file
    await fs.ftruncate(logFileHandle);

    // re-write the truncated log file
    await fs.write(logFileHandle, logBuffer);
    await fs.close(logFileHandle);
  }

  #createLogDirectory() {
    try {
      fs.mkdirSync(this.options.path, {
        recursive: true,
        mode: '0775',
      });
    } catch {
      return false;
    }

    return true;
  }

  async #toFile(string) {
    /*try {
      await this.#truncateFile();
    } catch {
      //ignore
    }*/

    const output = `${string}\r\n`;
    this.stream.write(output);
  }
}
