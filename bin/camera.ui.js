#!/usr/bin/env node

process.title = 'camera.ui';

import fs from 'fs-extra';
import cluster from 'cluster';
import os from 'os';
import path from 'path';
import commander from 'commander';
import { fileURLToPath } from 'url';

import LoggerService from '../src/services/logger/logger.service.js';
import ConfigService from '../src/services/config/config.service.js';

import Interface from '../src/main.js';

let moduleName = 'camera.ui';
let globalInstalled = '1';
let sudoEnabled = '1';
let logLevel = '1';
let logTimestamps = '1';
let logColourful = '1';
let storagePath = path.resolve(os.homedir(), '.camera.ui');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = fs.readJsonSync(path.resolve(__dirname, '../package.json'));

commander
  .allowUnknownOption()
  .option(
    '-L, --log-level [level]',
    'Change Log Level: 1 = Info (Default), 2 = Debug, 3 = Warn, 4 = Error',
    (l) => (logLevel = l)
  )
  .option('-C, --no-color', 'Disable color in logging', () => (logColourful = '0'))
  .option('-T, --no-timestamp', 'Do not issue timestamps in logging', () => (logTimestamps = '0'))
  .option('--no-sudo', 'Disable sudo for updating through ui', () => (sudoEnabled = '0'))
  .option('--no-global', 'Disable global (-g) prefix for updating through ui', () => (globalInstalled = '0'))
  .option(
    '-S, --storage-path [path]',
    'Look for camera.ui files at [path] instead of the default location (~/.camera.ui)',
    (p) => (storagePath = p)
  )
  .parse(process.argv);

// node-telegram-bot-api
process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 1;

process.env.CUI_SERVICE_MODE = '1';

process.env.CUI_LOG_COLOR = logColourful;
process.env.CUI_LOG_MODE = logLevel;
process.env.CUI_LOG_TIMESTAMPS = logTimestamps;

process.env.CUI_BASE_PATH = path.resolve(__dirname, '../');

process.env.CUI_STORAGE_PATH = storagePath;
process.env.CUI_STORAGE_CONFIG_FILE = path.resolve(storagePath, 'config.json');
process.env.CUI_STORAGE_DATABASE_PATH = path.resolve(storagePath, 'database');
process.env.CUI_STORAGE_DATABASE_USER_PATH = path.resolve(storagePath, 'database', 'user');
process.env.CUI_STORAGE_DATABASE_FILE = path.resolve(storagePath, 'database', 'database.json');
process.env.CUI_STORAGE_LOG_PATH = path.resolve(storagePath, 'logs');
process.env.CUI_STORAGE_LOG_FILE = path.resolve(storagePath, 'logs', 'camera.ui.log');
process.env.CUI_STORAGE_RECORDINGS_PATH = path.resolve(storagePath, 'recordings');
process.env.CUI_STORAGE_REPORTS_PATH = path.resolve(storagePath, 'reports');

process.env.CUI_MODULE_NAME = moduleName;
process.env.CUI_MODULE_VERSION = packageJson.version;
process.env.CUI_MODULE_GLOBAL = globalInstalled;
process.env.CUI_MODULE_SUDO = sudoEnabled;

process.env.CUI_VERSION = packageJson.version;

const logger = new LoggerService();

const configJson = fs.readJSONSync(process.env.CUI_STORAGE_CONFIG_FILE, { throws: false });
const config = new ConfigService(configJson);

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
  new Interface(logger, config);
}
