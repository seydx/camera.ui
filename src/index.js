'use-strict';

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = fs.readJsonSync(path.resolve(__dirname, '../package.json'));

import LoggerService from './services/logger/logger.service.js';
import ConfigService from './services/config/config.service.js';

import Interface from './main.js';

export default class CameraUI {
  constructor(configJson = {}, storagePath, logger, environment = {}) {
    if (!storagePath) {
      throw new Error('No storage path was given for camera.ui');
    }

    process.env.CUI_SERVICE_MODE = 2;
    process.env.CUI_LOG_COLOR = 1;
    process.env.CUI_LOG_TIMESTAMPS = 1;

    if (configJson.debug) {
      process.env.CUI_LOG_DEBUG = 1;
    }

    // node-telegram-bot-api
    process.env.NTBA_FIX_319 = 1;
    process.env.NTBA_FIX_350 = 1;

    process.env.CUI_BASE_PATH = path.resolve(__dirname, '../');

    process.env.CUI_STORAGE_PATH = storagePath;
    process.env.CUI_STORAGE_CONFIG_FILE = path.resolve(storagePath, 'config.json');
    process.env.CUI_STORAGE_DATABASE_PATH = path.resolve(storagePath, 'database');
    process.env.CUI_STORAGE_DATABASE_USER_PATH = path.resolve(storagePath, 'database', 'user');
    process.env.CUI_STORAGE_DATABASE_FILE = path.resolve(storagePath, 'database', 'database.json');
    process.env.CUI_STORAGE_LOG_PATH = path.resolve(storagePath, 'logs');
    process.env.CUI_STORAGE_LOG_FILE = path.resolve(storagePath, 'logs', 'camera.ui.log.txt');
    process.env.CUI_STORAGE_RECORDINGS_PATH = path.resolve(storagePath, 'recordings');

    if (Object.keys(configJson).length > 0) {
      fs.ensureFileSync(process.env.CUI_STORAGE_CONFIG_FILE);
      fs.writeJSONSync(process.env.CUI_STORAGE_CONFIG_FILE, configJson, { spaces: 2 });
    }

    process.env.CUI_MODULE_NAME = environment.moduleName || 'camera.ui';
    process.env.CUI_MODULE_VERSION = environment.moduleVersion || packageJson.version;
    process.env.CUI_MODULE_GLOBAL = environment.global ? '1' : '0';
    process.env.CUI_MODULE_SUDO = environment.sudo ? '1' : '0';

    process.env.CUI_VERSION = packageJson.version;

    const log = new LoggerService(logger);
    const config = new ConfigService();

    return new Interface(log, config);
  }
}
