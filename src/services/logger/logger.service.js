'use-strict';

const chalk = require('chalk');
const { FileLogger } = require('./utils/filelogger.utils');
const moment = require('moment');
const { customAlphabet } = require('nanoid/async');
const nanoid = customAlphabet('1234567890abcdef', 10);

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
  static #filelogger;

  static logPath;
  static notificationsDB;
  static socket;

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
      toast: this.toast,
      file: this.file,
      db: LoggerService.#db,
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

  static #formatMessage(message, name) {
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

    return formatted;
  }

  static async #db(level, message, name = 'System', subprefix = 'Console') {
    if (LoggerService.notificationsDB) {
      //Check notification size, if we exceed more than {1000} notifications, remove the latest
      const notificationsLimit = 1000;
      const notificationList = LoggerService.notificationsDB.get('notifications').value();

      if (notificationList.length > notificationsLimit) {
        const diff = notificationList.length - notificationsLimit;
        LoggerService.notificationsDB.get('notifications').dropRight(notificationList, diff).write();
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

      LoggerService.notificationsDB.get('notifications').push(notification).write();
      LoggerService.socket?.emit('notification', notification);
      LoggerService.socket?.emit('increase_notification');
    }
  }

  static #logging(level, message, name) {
    if (LoggerService.#customLogger) {
      return LoggerService.#logger.log[level](message, name);
    }

    if (level === LogLevel.DEBUG && !LoggerService.#debugEnabled) {
      return;
    }

    //let fileMessage = (message = LoggerService.#formatMessage(message, name));
    message = LoggerService.#formatMessage(message, name);

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

  info(message, name) {
    LoggerService.#logging(LogLevel.INFO, message, name);
  }

  warn(message, name, subprefix) {
    LoggerService.#logging(LogLevel.WARN, message, name);
    LoggerService.#db(LogLevel.WARN, message, name, subprefix);
  }

  error(message, name, subprefix) {
    LoggerService.#logging(LogLevel.ERROR, message, name);
    LoggerService.#db(LogLevel.ERROR, message, name, subprefix);
  }

  debug(message, name) {
    LoggerService.#logging(LogLevel.DEBUG, message, name);
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

  file(message) {
    LoggerService.#filelogger.log(message);
    LoggerService.socket?.emit('logMessage', message);
  }
}

exports.LoggerService = LoggerService;
