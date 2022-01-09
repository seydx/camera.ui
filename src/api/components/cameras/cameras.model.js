'use-strict';

const { getAndStoreSnapshot } = require('../../../common/ffmpeg');
const { Ping } = require('../../../common/ping');

const { ConfigService } = require('../../../services/config/config.service');

const { Database } = require('../../database');

const { CameraController } = require('../../../controller/camera/camera.controller');

exports.list = async () => {
  await Database.interfaceDB.read();
  return await Database.interfaceDB.get('cameras').value();
};

exports.findByName = async (name) => {
  await Database.interfaceDB.read();
  return await Database.interfaceDB.get('cameras').find({ name: name }).value();
};

exports.getSettingsByName = async (name) => {
  await Database.interfaceDB.read();

  const settings = await Database.interfaceDB.get('settings').get('cameras').value();
  const cameraSetting = settings.find((cameraSetting) => cameraSetting && cameraSetting.name === name);

  return cameraSetting;
};

exports.createCamera = async (cameraData) => {
  const camExist = ConfigService.ui.cameras.find((cam) => cam.name === cameraData.name);

  if (!camExist) {
    await Database.interfaceDB.read();

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
exports.patchCamera = async (name, cameraData) => {
  if (
    cameraData.name &&
    name !== cameraData.name &&
    ConfigService.ui.cameras.some((camera) => camera.name === cameraData.name)
  ) {
    throw new Error('Camera already exists in config.json');
  }

  await Database.interfaceDB.read();

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

  return await Database.interfaceDB.get('cameras').find({ name: name }).assign(cameraData).write();
};

exports.pingCamera = async (camera, timeout) => {
  timeout = (Number.parseInt(timeout) || 0) < 1 ? 1 : Number.parseInt(timeout);
  return await Ping.status(camera, timeout);
};

exports.requestSnapshot = async (camera) => {
  return await getAndStoreSnapshot(camera);
};

exports.removeByName = async (name) => {
  await Database.interfaceDB.read();

  ConfigService.ui.cameras = ConfigService.ui.cameras.filter((camera) => camera.name !== name);
  ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);

  await CameraController.removeController(name);

  await Database.writeConfigCamerasToDB();
  Database.controller?.emit('removeCamera', name);

  return;
};

exports.removeAll = async () => {
  await Database.interfaceDB.read();

  const cameras = ConfigService.ui.cameras.map((camera) => camera.name);

  ConfigService.ui.cameras = [];
  ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);

  for (const cameraName of cameras) {
    await CameraController.removeController(cameraName);
  }

  await Database.writeConfigCamerasToDB();
  Database.controller?.emit('removeCameras');

  return;
};
