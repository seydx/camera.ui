'use-strict';

const os = require('os');

const { ConfigService } = require('../../../services/config/config.service');

const { Database } = require('../../database');

exports.show = async (user, target) => {
  await Database.interfaceDB.read();

  let info = {
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    node: process.version,
    version: ConfigService.ui.version,
    firstStart: await Database.interfaceDB.get('firstStart').value(),
    language: ConfigService.ui.language,
    theme: ConfigService.ui.theme,
  };

  switch (target) {
    case 'ui':
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
      if (user && user.permissionLevel.includes('admin')) {
        info = {
          ...info,
          ...ConfigService.ui,
          ...ConfigService.interface,
        };
      }
      break;
    default:
      break;
  }

  return info;
};

exports.getByTarget = async (target) => {
  await Database.interfaceDB.read();
  return await Database.interfaceDB.get(target).value();
};

exports.patchByTarget = async (target, configData) => {
  await Database.interfaceDB.read();

  let settings = await Database.interfaceDB.value();

  for (const [key, value] of Object.entries(configData)) {
    if (settings[key] !== undefined) {
      settings[key] = value;
    }
  }

  return await Database.interfaceDB.get(target).assign(settings).write();
};
