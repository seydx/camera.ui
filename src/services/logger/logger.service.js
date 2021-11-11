'use-strict';

const chalk = require('chalk');
const { FileLogger } = require('./utils/filelogger.utils');

const LogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
};

function hookStream(stream, callback) {
  var old_write = stream.write;

  stream.write = (function (write) {
    return function (string, encoding, fd) {
      write.apply(stream, arguments); // comments this line if you don't want output in the console
      callback(string, encoding, fd);
    };
  })(stream.write);

  return function () {
    stream.write = old_write;
  };
}

class LoggerService {
  static #prefix = 'camera.ui';
  static #logger = console;
  static #customLogger = false;
  static #withPrefix = true;
  static #debugEnabled = false;
  static #timestampEnabled = false;

  static #socket;
  static #filelogger;

  static logPath;

  static create = (logger) => new LoggerService(logger);

  constructor(logger) {
    if (process.env.CUI_LOG_COLOR === '1') {
      chalk.level = 1;
    }

    //chalk.level = process.env.CUI_LOG_COLOR === '1' ? 1 : 0;

    if (process.env.CUI_LOG_DEBUG === '1') {
      LoggerService.#debugEnabled = true;
    }

    if (process.env.CUI_LOG_TIMESTAMPS === '1') {
      LoggerService.#timestampEnabled = true;
    }

    LoggerService.#filelogger = new FileLogger({
      path: process.env.CUI_STORAGE_LOG_PATH,
      fileName: 'camera.ui.log.txt',
    });

    LoggerService.log = {
      prefix: LoggerService.#prefix,
      info: this.info,
      warn: this.warn,
      error: this.error,
      debug: this.debug,
      notify: this.notify,
      file: this.file,
    };

    if (logger) {
      LoggerService.#prefix = logger.log.prefix || '';
      LoggerService.#logger = logger;
      LoggerService.#customLogger = true;
      LoggerService.#withPrefix = false;

      if (logger.createUiLogger) {
        logger.createUiLogger(LoggerService.log);
      }
    }
  }

  static #formatMessage(message, name, subprefix) {
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

  static #logging(level, message, name, subprefix) {
    if (LoggerService.#customLogger) {
      return LoggerService.#logger.log[level](message, name, subprefix);
    }

    if (level === LogLevel.DEBUG && !LoggerService.#debugEnabled) {
      return;
    }

    //let fileMessage = (message = LoggerService.#formatMessage(message, name, subprefix));
    message = LoggerService.#formatMessage(message, name, subprefix);

    const logger = LoggerService.#logger;
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

    if (LoggerService.#withPrefix) {
      message = chalk.magenta(`[${LoggerService.#prefix}] `) + message;
      //fileMessage = `[${this.#prefix}] ${fileMessage}`;
    }

    if (LoggerService.#timestampEnabled) {
      const date = new Date();
      message = chalk.white(`[${date.toLocaleString()}] `) + message;
      //fileMessage = `[${date.toLocaleString()}] ${fileMessage}`;
    }

    const unhookStdout = hookStream(process.stdout, () => {
      LoggerService.#filelogger.log(message);
      LoggerService.socket?.emit('logMessage', message);
    });

    const unhookStderr = hookStream(process.stderr, () => {
      LoggerService.#filelogger.log(message);
      LoggerService.socket?.emit('logMessage', message);
    });

    loggingFunction(message);

    unhookStdout();
    unhookStderr();
  }

  info(message, name, subprefix) {
    LoggerService.#logging(LogLevel.INFO, message, name, subprefix);
  }

  warn(message, name, subprefix) {
    LoggerService.#logging(LogLevel.WARN, message, name, subprefix);
  }

  error(message, name, subprefix) {
    LoggerService.#logging(LogLevel.ERROR, message, name, subprefix);
  }

  debug(message, name, subprefix) {
    LoggerService.#logging(LogLevel.DEBUG, message, name, subprefix);
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

    LoggerService.#logging(LogLevel.DEBUG, `Interface received new message: ${JSON.stringify(notification)}`);
    LoggerService.#socket?.emit('notification', notification);
  }

  file(message) {
    LoggerService.#filelogger.log(message);
    LoggerService.socket?.emit('logMessage', message);
  }
}

exports.LoggerService = LoggerService;
