'use-strict';

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { version } = require('../package.json');

const { LoggerService } = require('./services/logger/logger.service');

class CameraUI {
  constructor(config = {}, storagePath, logger, environment = {}) {
    storagePath = storagePath || path.resolve(os.homedir(), '.camera.ui');

    process.env.CUI_SERVICE_MODE = '2';

    if (!logger) {
      process.env.CUI_LOG_COLOR = 1;
      process.env.CUI_LOG_TIMESTAMPS = 1;
    }

    if (config.debug) {
      process.env.CUI_LOG_DEBUG = 1;
    }

    process.env.CUI_STORAGE_PATH = storagePath;
    process.env.CUI_STORAGE_CONFIG_FILE = path.resolve(storagePath, 'config.json');
    process.env.CUI_STORAGE_DATABASE_PATH = path.resolve(storagePath, 'database');
    process.env.CUI_STORAGE_DATABASE_USER_PATH = path.resolve(storagePath, 'database', 'user');
    process.env.CUI_STORAGE_DATABASE_FILE = path.resolve(storagePath, 'database', 'database.json');
    process.env.CUI_STORAGE_LOG_PATH = path.resolve(storagePath, 'logs');
    process.env.CUI_STORAGE_LOG_FILE = path.resolve(storagePath, 'logs', 'camera.ui.log.txt');
    process.env.CUI_STORAGE_RECORDINGS_PATH = path.resolve(storagePath, 'recordings');

    if (Object.keys(config).length > 0) {
      fs.ensureFileSync(process.env.CUI_STORAGE_CONFIG_FILE);
      fs.writeJSONSync(process.env.CUI_STORAGE_CONFIG_FILE, config, { spaces: 2 });
    }

    process.env.CUI_MODULE_NAME = environment.moduleName || 'camera.ui';
    process.env.CUI_MODULE_VERSION = environment.moduleVersion || version;
    process.env.CUI_MODULE_GLOBAL = environment.global ? '1' : '0';
    process.env.CUI_MODULE_SUDO = environment.sudo ? '1' : '0';

    LoggerService.create(logger);

    return require('./main');
  }
}

module.exports = CameraUI;
