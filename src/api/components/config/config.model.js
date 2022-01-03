'use-strict';

//const fs = require('fs-extra');
const os = require('os');

const { ConfigService } = require('../../../services/config/config.service');

const { Database } = require('../../database');

const { CameraController } = require('../../../controller/camera/camera.controller');

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
    serviceMode: ConfigService.serviceMode,
    env: ConfigService.env,
  };

  switch (target) {
    case 'config':
      if (user && user.permissionLevel.includes('admin')) {
        info = {
          ...info,
          ...ConfigService.configJson,
        };
      }
      break;
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
          ...ConfigService.configJson,
        };
      }
      break;
    default:
      break;
  }

  return info;
};

exports.patchConfig = async (configJson) => {
  if (process.env.CUI_SERVICE_MODE === '2') {
    Database.controller.emit('config', configJson);
  }

  ConfigService.writeToConfig(false, configJson);
  await Database.writeConfigCamerasToDB();

  if (configJson?.cameras) {
    for (const camera of configJson.cameras) {
      CameraController.reconfigureController(camera.name);
    }
  }
};
