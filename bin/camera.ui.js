#!/usr/bin/env node

process.title = 'camera.ui';

const cluster = require('cluster');
const os = require('os');
const path = require('path');
const commander = require('commander');
const { version } = require('../package.json');

const { LoggerService } = require('../src/services/logger/logger.service');

let moduleName = 'camera.ui';
let globalInstalled = '1';
let sudoEnabled = '1';
let debugEnabled = '0';
let logTimestamps = '1';
let logColourful = '1';
let storagePath = path.resolve(os.homedir(), '.camera.ui');

commander
  .allowUnknownOption()
  .option('-D, --debug', 'turn on debug level logging', () => (debugEnabled = '1'))
  .option('-C, --no-color', 'disable color in logging', () => (logColourful = '0'))
  .option('-T, --no-timestamp', 'do not issue timestamps in logging', () => (logTimestamps = '0'))
  .option('--no-sudo', 'disable sudo for updating through ui', () => (sudoEnabled = '0'))
  .option('--no-global', 'disable global (-g) prefix for updating through ui', () => (globalInstalled = '0'))
  .option(
    '-S, --storage-path [path]',
    'look for camera.ui files at [path] instead of the default location (~/.camera.ui)',
    (p) => (storagePath = p)
  )
  .parse(process.argv);

process.env.CUI_SERVICE_MODE = '1';

process.env.CUI_LOG_COLOR = logColourful;
process.env.CUI_LOG_DEBUG = debugEnabled;
process.env.CUI_LOG_TIMESTAMPS = logTimestamps;

process.env.CUI_STORAGE_PATH = storagePath;
process.env.CUI_STORAGE_CONFIG_FILE = path.resolve(storagePath, 'config.json');
process.env.CUI_STORAGE_DATABASE_PATH = path.resolve(storagePath, 'database');
process.env.CUI_STORAGE_DATABASE_USER_PATH = path.resolve(storagePath, 'database', 'user');
process.env.CUI_STORAGE_DATABASE_FILE = path.resolve(storagePath, 'database', 'database.json');
process.env.CUI_STORAGE_LOG_PATH = path.resolve(storagePath, 'logs');
process.env.CUI_STORAGE_LOG_FILE = path.resolve(storagePath, 'logs', 'camera.ui.log.txt');
process.env.CUI_STORAGE_RECORDINGS_PATH = path.resolve(storagePath, 'recordings');

process.env.CUI_MODULE_NAME = moduleName;
process.env.CUI_MODULE_VERSION = version;
process.env.CUI_MODULE_GLOBAL = globalInstalled;
process.env.CUI_MODULE_SUDO = sudoEnabled;

LoggerService.create();

if (cluster.isPrimary) {
  const { log } = LoggerService;
  let shuttingDown = false;

  cluster.on('exit', (worker, code) => {
    if (code !== 0 && !worker.exitedAfterDisconnect) {
      const worker = cluster.fork();
      log.info(`Restarting camera.ui with PID: ${worker.process.pid}`);
    }
  });

  // eslint-disable-next-line no-unused-vars
  const signalHandler = (signal, signalNumber) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    log.warn(`Got ${signal}, shutting down camera.ui...`, 'System', 'system');

    setTimeout(() => {
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(128 + signalNumber);
    }, 5000);

    cluster.disconnect();
  };

  const errorHandler = (error) => {
    if (error.stack) {
      log.info(error.stack);
    }

    if (!shuttingDown) {
      process.kill(process.pid, 'SIGTERM');
    }
  };

  process.on('SIGINT', signalHandler.bind(undefined, 'SIGINT', 2));
  process.on('SIGTERM', signalHandler.bind(undefined, 'SIGTERM', 15));
  process.on('uncaughtException', errorHandler);

  cluster.fork();
} else {
  require('../src/main');
}
