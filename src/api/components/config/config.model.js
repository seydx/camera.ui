'use-strict';

const os = require('os');

const { ConfigService } = require('../../../services/config/config.service');

const { Database } = require('../../database');

exports.show = async (user, target = 'all') => {
  await Database.interfaceDB.read();

  let info = {
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    node: process.version,
    version: ConfigService.ui.version,
    firstStart: await Database.interfaceDB.get('firstStart').value(),
  };

  switch (target) {
    case 'ui':
      info = {
        ...info,
        language: ConfigService.ui.language,
        theme: ConfigService.ui.theme,
      };

      if (user && user.permissionLevel.includes('admin')) {
        info = {
          ...info,
          ...ConfigService.ui,
        };
      }
      break;
    case 'interface':
      if (user && user.permissionLevel.includes('admin')) {
        info = {
          ...info,
          ...ConfigService.interface,
        };
      }
      break;
    case 'all':
      info = {
        ...info,
        language: ConfigService.ui.language,
        theme: ConfigService.ui.theme,
      };

      if (user && user.permissionLevel.includes('admin')) {
        info = {
          ...info,
          ...ConfigService.ui,
          ...ConfigService.interface,
        };
      }

      info = {
        ...info,
        language: ConfigService.ui.language,
        theme: ConfigService.ui.theme,
      };
      break;
    default:
      break;
  }

  return info;
};
