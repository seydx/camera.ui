'use-strict';

const path = require('path');
const { version } = require('../package.json');

let moduleName = 'camera.ui';
let globalInstalled = '1';
let sudoEnabled = '1';
let debugEnabled = '0';
let logTimestamps = '1';
let logColourful = '1';
let storagePath = path.resolve('test', 'camera.ui');

const { LoggerService } = require('../src/services/logger/logger.service');

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

const { ConfigService } = require('../src/services/config/config.service');
ConfigService.config;
