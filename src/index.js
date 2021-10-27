'use-strict';

const path = require('path');
const os = require('os');

const { LoggerService } = require('./services/logger/logger.service');

class CameraUI {
  constructor(userConfig = {}, storagePath, logger) {
    storagePath = storagePath || path.resolve(os.homedir(), '.camera.ui');

    process.env.CUI_SERVICE_MODE = '2';

    if (!logger) {
      process.env.CUI_LOG_COLOR = 1;
      process.env.CUI_LOG_TIMESTAMPS = 1;
    }

    if (userConfig.debug) {
      process.env.CUI_LOG_DEBUG = 1;
    }

    process.env.CUI_STORAGE_PATH = storagePath;
    process.env.CUI_STORAGE_CONFIG_FILE = path.resolve(storagePath, 'config.json');
    process.env.CUI_STORAGE_DATABASE_PATH = path.resolve(storagePath, 'database');
    process.env.CUI_STORAGE_DATABASE_USER_PATH = path.resolve(storagePath, 'database', 'user');
    process.env.CUI_STORAGE_DATABASE_FILE = path.resolve(storagePath, 'database', 'database.json');
    process.env.CUI_STORAGE_RECORDINGS_PATH = path.resolve(storagePath, 'recordings');

    LoggerService.create(logger);

    return require('./main');
  }
}

module.exports = CameraUI;
