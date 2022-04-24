'use-strict';

import chalk from 'chalk';
import moment from 'moment';
import { customAlphabet } from 'nanoid/async';

import FileLogger from './utils/filelogger.utils.js';

const nanoid = customAlphabet('1234567890abcdef', 10);

const LogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
};

const hook_writestream = (stream, callback) => {
  var old_write = stream.write;

  stream.write = (function (write) {
    return function (string, encoding, fd) {
      write.apply(stream, arguments);
      callback(string, encoding, fd);
    };
  })(stream.write);

  return function () {
    stream.write = old_write;
  };
};

export default class LoggerService {
  static #prefix = 'camera.ui';
  static #logger = console;
  static #customLogger = false;
  static #withPrefix = true;
  static #logLevel = 'info';
  static #timestampEnabled = false;
  static #filelogger;

  static logPath;
  static notificationsDB;
  static socket;

  constructor(logger) {
    /**
     * logger = {
     *   createUiLogger: (cameraUiLogger) => {},
     *   log: {
     *     prefix: 'MyLogger',
     *     info: console.info,
     *     warn: console.warn,
     *     error: console.error,
     *     debug: console.debug,
     *   },
     * }
     */

    if (process.env.CUI_LOG_COLOR === '1') {
      chalk.level = 1;
    }

    switch (process.env.CUI_LOG_MODE) {
      case '1':
        LoggerService.#logLevel = 'info';
        break;
      case '2':
        LoggerService.#logLevel = 'debug';
        break;
      case '3':
        LoggerService.#logLevel = 'warn';
        break;
      case '4':
        LoggerService.#logLevel = 'error';
        break;
      default:
        LoggerService.#logLevel = 'info';
        break;
    }

    if (process.env.CUI_LOG_TIMESTAMPS === '1') {
      LoggerService.#timestampEnabled = true;
    }

    LoggerService.#filelogger = new FileLogger({
      path: process.env.CUI_STORAGE_LOG_PATH,
      fileName: 'camera.ui.log',
    });

    if (logger?.log) {
      LoggerService.#prefix = logger.log.prefix;
      LoggerService.#logger = logger;
      LoggerService.#customLogger = true;
      LoggerService.#withPrefix = Boolean(logger.log.prefix);
    }

    // eslint-disable-next-line no-unused-vars
    const unhookStdout = hook_writestream(process.stdout, function (string, encoding, fd) {
      LoggerService.#filelogger?.stream.write(string, encoding || 'utf8');
    });

    // eslint-disable-next-line no-unused-vars
    const unhookStderr = hook_writestream(process.stderr, function (string, encoding, fd) {
      LoggerService.#filelogger?.stream.write(string, encoding || 'utf8');
    });

    // eslint-disable-next-line no-unused-vars
    LoggerService.#filelogger?.stream.once('error', function (error) {
      unhookStdout();
      unhookStderr();
    });

    LoggerService.#filelogger?.stream.once('close', function () {
      unhookStdout();
      unhookStderr();
    });

    setInterval(() => {
      LoggerService.#filelogger.truncateFile();
    }, 1000 * 60 * 60 * 2);

    LoggerService.log = {
      prefix: LoggerService.#prefix,
      info: this.info,
      warn: this.warn,
      error: this.error,
      debug: this.debug,
      notify: this.notify,
      toast: this.toast,
      db: LoggerService.#db,
    };

    if (logger?.createUiLogger) {
      logger.createUiLogger(LoggerService.log);
    }

    return LoggerService.log;
  }

  static allowLogging(level) {
    switch (level) {
      case 'info':
        return Boolean(LoggerService.#logLevel === LogLevel.DEBUG || LoggerService.#logLevel === LogLevel.INFO);
      case 'debug':
        return Boolean(LoggerService.#logLevel === LogLevel.DEBUG);
      case 'warn':
        return Boolean(
          LoggerService.#logLevel === LogLevel.WARN ||
            LoggerService.#logLevel === LogLevel.ERROR ||
            LoggerService.#logLevel === LogLevel.INFO ||
            LoggerService.#logLevel === LogLevel.DEBUG
        );
      case 'error':
        return Boolean(
          LoggerService.#logLevel === LogLevel.ERROR ||
            LoggerService.#logLevel === LogLevel.INFO ||
            LoggerService.#logLevel === LogLevel.DEBUG
        );
      default:
        return false;
    }
  }

  static formatMessage(message, name, level) {
    let formatted = '';

    if (name) {
      formatted += `${name}: `;
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

    if (level === LogLevel.WARN) {
      formatted = `${chalk.bgYellowBright.black.bold(' WARNING ')} ` + formatted;
    } else if (level === LogLevel.ERROR) {
      formatted = `${chalk.bgRedBright.white.bold(' ERROR ')} ` + formatted;
    }

    switch (level) {
      case LogLevel.WARN:
        formatted = chalk.yellow(formatted);
        break;
      case LogLevel.ERROR:
        formatted = chalk.red(formatted);
        break;
      case LogLevel.DEBUG:
        formatted = chalk.gray(formatted);
        break;
    }

    return formatted;
  }

  static async #db(level, message, name = 'System', subprefix = 'Console') {
    if (LoggerService.notificationsDB) {
      //Check notification size, if we exceed more than {1000} notifications, remove the latest
      const notificationsLimit = 1000;
      const notificationList = LoggerService.notificationsDB.chain.get('notifications').value();

      if (notificationList.length > notificationsLimit) {
        const diff = notificationList.length - notificationsLimit;
        LoggerService.notificationsDB.chain.get('notifications').dropRight(notificationList, diff).value();
      }

      const notification = {
        id: await nanoid(),
        type: level.toUpperCase(),
        title: name,
        message: message.message || message,
        timestamp: moment().unix(),
        time: moment().format('YYYY-MM-DD HH:mm:ss'),
        label: subprefix.charAt(0).toUpperCase() + subprefix.slice(1),
        isSystemNotification: true,
      };

      LoggerService.notificationsDB.chain.get('notifications').push(notification).value();
      LoggerService.socket?.emit('notification', notification);
      LoggerService.socket?.emit('increase_notification');
    }
  }

  static #logging(level, message, name, fromExtern) {
    if (!LoggerService.allowLogging(level)) {
      return;
    }

    let origMessage = message;
    let formattedMessage = LoggerService.formatMessage(message, name, level);

    if (LoggerService.#withPrefix) {
      formattedMessage = chalk.cyan(`[${LoggerService.#prefix}] `) + formattedMessage;
    }

    if (LoggerService.#timestampEnabled) {
      const date = new Date();
      formattedMessage = chalk.white(`[${date.toLocaleString()}] `) + formattedMessage;
    }

    LoggerService.socket?.emit('logMessage', formattedMessage);

    if (LoggerService.#customLogger && !fromExtern) {
      return LoggerService.#logger.log[level](origMessage, name, false, true);
    }

    const logger = LoggerService.#logger;
    const loggingFunction =
      level === LogLevel.WARN ? logger.warn : level === LogLevel.ERROR ? logger.error : logger.log;

    loggingFunction(formattedMessage);
  }

  info(message, name, subprefix, fromExtern) {
    LoggerService.#logging(LogLevel.INFO, message, name, false, fromExtern);
  }

  warn(message, name, subprefix, fromExtern) {
    LoggerService.#logging(LogLevel.WARN, message, name);
    LoggerService.#db(LogLevel.WARN, message, name, subprefix, fromExtern);
  }

  error(message, name, subprefix, fromExtern) {
    LoggerService.#logging(LogLevel.ERROR, message, name);
    LoggerService.#db(LogLevel.ERROR, message, name, subprefix, fromExtern);
  }

  debug(message, name, subprefix, fromExtern) {
    LoggerService.#logging(LogLevel.DEBUG, message, name, false, fromExtern);
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
    LoggerService.socket?.emit('notification', notification);
  }

  toast(message) {
    LoggerService.#logging(LogLevel.DEBUG, `Toasting new message: ${message}`);
    LoggerService.socket?.emit('toast', message);
  }
}
