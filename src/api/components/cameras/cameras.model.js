'use-strict';

import { getAndStoreSnapshot } from '../../../common/ffmpeg.js';
import Ping from '../../../common/ping.js';

import ConfigService from '../../../services/config/config.service.js';

import Database from '../../database.js';

import CameraController from '../../../controller/camera/camera.controller.js';

export const list = async () => {
  return await Database.interfaceDB.chain.get('cameras').cloneDeep().value();
};

export const findByName = async (name) => {
  return await Database.interfaceDB.chain.get('cameras').find({ name: name }).cloneDeep().value();
};

export const getSettingsByName = async (name) => {
  return await Database.interfaceDB.chain.get('settings').get('cameras').find({ name: name }).cloneDeep().value();
};

export const createCamera = async (cameraData) => {
  const camExist = ConfigService.ui.cameras.find((cam) => cam.name === cameraData.name);

  if (!camExist) {
    ConfigService.ui.cameras.push(cameraData);
    ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);

    CameraController.createController(cameraData);
    await CameraController.startController(cameraData.name);

    await Database.writeConfigCamerasToDB();
    Database.controller?.emit('addCamera', cameraData);

    return cameraData;
  } else {
    return false;
  }
};

// todo: not used, handled through system/config
export const patchCamera = async (name, cameraData) => {
  if (
    cameraData.name &&
    name !== cameraData.name &&
    ConfigService.ui.cameras.some((camera) => camera.name === cameraData.name)
  ) {
    throw new Error('Camera already exists in config.json');
  }

  ConfigService.ui.cameras = ConfigService.ui.cameras.map((camera) => {
    if (camera.name === cameraData.name) {
      camera = {
        ...camera,
        ...cameraData,
      };
    }

    return camera;
  });
  ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);
  await Database.writeConfigCamerasToDB();

  return await Database.interfaceDB.chain.get('cameras').find({ name: name }).assign(cameraData).value();
};

export const pingCamera = async (camera, timeout) => {
  timeout = (Number.parseInt(timeout) || 0) < 1 ? 1 : Number.parseInt(timeout);
  return await Ping.status(camera, timeout);
};

export const requestSnapshot = async (camera, fromSubSource) => {
  return await getAndStoreSnapshot(camera, fromSubSource);
};

export const removeByName = async (name) => {
  ConfigService.ui.cameras = ConfigService.ui.cameras.filter((camera) => camera.name !== name);
  ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);

  await CameraController.removeController(name);

  await Database.writeConfigCamerasToDB();
  Database.controller?.emit('removeCamera', name);
};

export const removeAll = async () => {
  const cameras = ConfigService.ui.cameras.map((camera) => camera.name);

  ConfigService.ui.cameras = [];
  ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);

  for (const cameraName of cameras) {
    await CameraController.removeController(cameraName);
  }

  await Database.writeConfigCamerasToDB();
  Database.controller?.emit('removeCameras');
};
