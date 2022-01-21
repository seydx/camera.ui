'use-strict';

import os from 'os';

import ConfigService from '../../../services/config/config.service.js';

import Database from '../../database.js';

import CameraController from '../../../controller/camera/camera.controller.js';

export const show = async (user, target) => {
  let info = {
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    node: process.version,
    version: ConfigService.ui.version,
    firstStart: await Database.interfaceDB.chain.get('firstStart').cloneDeep().value(),
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

export const patchConfig = async (configJson) => {
  Database.controller.emit('config', configJson);
  ConfigService.writeToConfig(false, configJson);
  await Database.writeConfigCamerasToDB();

  if (ConfigService.ui.cameras) {
    for (const camera of ConfigService.ui.cameras) {
      CameraController.reconfigureController(camera.name);
    }
  }
};
