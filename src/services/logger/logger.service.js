'use-strict';

const chalk = require('chalk');

const LogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
};

class LoggerService {
  static #prefix = 'camera.ui';
  static #logger = console;
  static #withPrefix = true;
  static #debugEnabled = false;
  static #timestampEnabled = false;

  static socket;

  static create = (logger) => new LoggerService(logger);

  constructor(logger) {
    if (logger) {
      LoggerService.#prefix = '';
      LoggerService.#logger = logger;
      LoggerService.#withPrefix = false;
    }

    chalk.level = process.env.CUI_LOG_COLOR === '1' ? 1 : 0;

    if (process.env.CUI_LOG_DEBUG === '1') {
      LoggerService.#debugEnabled = true;
    }

    if (process.env.CUI_LOG_TIMESTAMPS === '1') {
      LoggerService.#timestampEnabled = true;
    }

    LoggerService.log = {
      prefix: LoggerService.#prefix,
      info: this.info,
      warn: this.warn,
      error: this.error,
      debug: this.debug,
      notify: this.notify,
    };
  }

  static formatMessage(message, name, subprefix) {
    let formatted = '';

    if (name || subprefix) {
      if (typeof subprefix === 'string') {
        formatted += `${subprefix} `;
      } else if (subprefix) {
        formatted += '[Interface] ';
      }

      if (name) {
        formatted += `${name}: `;
      }
    }

    if (message instanceof Error) {
      //const error = message;
      //formatted = error.message || error;
      formatted = message;
    } else if (typeof message === 'object') {
      formatted += JSON.stringify(message);
    } else {
      formatted += message;
    }

    return formatted;
  }

  static logging(level, message, name, subprefix) {
    if (level === LogLevel.DEBUG && !this.#debugEnabled) {
      return;
    }

    message = this.formatMessage(message, name, subprefix);

    const logger = this.#logger;
    let loggingFunction = logger.log;

    switch (level) {
      case LogLevel.WARN:
        message = chalk.yellow(message);
        loggingFunction = logger.warn;
        break;
      case LogLevel.ERROR:
        message = chalk.red(message);
        loggingFunction = logger.error;
        break;
      case LogLevel.DEBUG:
        message = chalk.gray(message);
        break;
    }

    if (this.#withPrefix) {
      message = chalk.magenta(`[${this.#prefix}] `) + message;
    }

    if (this.#timestampEnabled) {
      const date = new Date();
      message = chalk.white(`[${date.toLocaleString()}] `) + message;
    }

    loggingFunction(message);
  }

  info(message, name, subprefix) {
    LoggerService.logging(LogLevel.INFO, message, name, subprefix);
  }

  warn(message, name, subprefix) {
    LoggerService.logging(LogLevel.WARN, message, name, subprefix);
  }

  error(message, name, subprefix) {
    LoggerService.logging(LogLevel.ERROR, message, name, subprefix);
  }

  debug(message, name, subprefix) {
    LoggerService.logging(LogLevel.DEBUG, message, name, subprefix);
  }

  notify(notification) {
    /*
     * Required: title, message, subtxt
     * Optional: thumbnail, mediaSource
     *
     * If count = true, navbar will count notification
     *
     * eg.
     * notification = {
     *   title: "Motion!",
     *   message: "Test camera - 2020/10/11 12:04am",
     *   subtxt: "Living Room",
     *   thumbnail: "/path/to/thumbnail/file.jpg",
     *   mediaSource: "/path/to/media/file.mp4",
     *   count: true,
     * };
     */

    LoggerService.logging(LogLevel.DEBUG, `Interface received new message: ${JSON.stringify(notification)}`);
    LoggerService.socket?.emit('notification', notification);
  }
}

exports.LoggerService = LoggerService;
