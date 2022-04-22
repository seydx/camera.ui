'use-strict';

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

import LoggerService from '../src/services/logger/logger.service.js';
import ConfigService from '../src/services/config/config.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = fs.readJsonSync(path.resolve(__dirname, '../package.json'));

let moduleName = 'camera.ui';
let globalInstalled = '1';
let sudoEnabled = '1';
let logLevel = '1';
let logTimestamps = '1';
let logColourful = '1';
let storagePath = path.resolve('test', 'camera.ui');

// node-telegram-bot-api
process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 1;

process.env.CUI_SERVICE_MODE = '1';

process.env.CUI_LOG_COLOR = logColourful;
process.env.CUI_LOG_MODE = logLevel;
process.env.CUI_LOG_TIMESTAMPS = logTimestamps;

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

new LoggerService();
new ConfigService();
