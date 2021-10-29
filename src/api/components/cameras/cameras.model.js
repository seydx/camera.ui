'use-strict';

const _ = require('lodash');

const { getAndStoreSnapshot } = require('../../../common/ffmpeg');
const { Ping } = require('../../../common/ping');

const { ConfigService } = require('../../../services/config/config.service');

const { Database } = require('../../database');

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

    return await Database.interfaceDB.get('cameras').push(cameraData).write();
  } else {
    throw new Error('Camera already exists in config.json');
  }
};

exports.patchCamera = async (name, cameraData) => {
  if (
    cameraData.name &&
    name !== cameraData.name &&
    ConfigService.ui.cameras.some((camera) => camera.name === cameraData.name)
  ) {
    throw new Error('Camera already exists in config.json');
  }

  await Database.interfaceDB.read();

  let cameraConfig = _.find(ConfigService.ui.cameras, { name: name });
  _.assign(cameraConfig, cameraData);

  ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);

  return await Database.interfaceDB.get('cameras').find({ name: name }).assign(cameraData).write();
};

exports.pingCamera = async (cameraName, videoConfig, timeout) => {
  timeout = (Number.parseInt(timeout) || 0) < 1 ? 1 : Number.parseInt(timeout);
  return await Ping.status(cameraName, videoConfig, timeout);
};

exports.requestSnapshot = async (cameraName, videoConfig) => {
  return await getAndStoreSnapshot(cameraName, videoConfig);
};

exports.removeByName = async (name) => {
  await Database.interfaceDB.read();

  _.remove(ConfigService.ui.cameras, (cam) => cam.name === name);
  ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);

  return await Database.interfaceDB
    .get('cameras')
    .remove((cam) => cam.name === name)
    .write();
};

exports.removeAll = async () => {
  await Database.interfaceDB.read();

  ConfigService.ui.cameras = [];
  ConfigService.writeToConfig('cameras', ConfigService.ui.cameras);

  return await Database.interfaceDB
    .get('cameras')
    .remove(() => true)
    .write();
};
