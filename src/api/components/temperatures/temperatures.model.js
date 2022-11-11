'use-strict';

import moment from 'moment';
import { customAlphabet } from 'nanoid/async';

import Cleartimer from '../../../common/cleartimer.js';

import Database from '../../database.js';

const nanoid = customAlphabet('1234567890abcdef', 10);
const temperaturesLimit = 100;

export const list = async (query) => {
  // eslint-disable-next-line unicorn/consistent-function-scoping
  const GetSortOrder = (property) => {
    return (a, b) => {
      if (a[property] < b[property]) {
        return 1;
      } else if (a[property] > b[property]) {
        return -1;
      }
      return 0;
    };
  };

  let temperatures = await Database.interfaceDB.chain.get('temperatures').cloneDeep().value();
  temperatures.push(...Database.notificationsDB.chain.get('temperatures').cloneDeep().value());
  temperatures.sort(GetSortOrder('timestamp'));

  if (moment(query.from, 'YYYY-MM-DD').isValid()) {
    temperatures = temperatures.filter((notification) => {
      const date = moment.unix(notification.timestamp).format('YYYY-MM-DD');
      const dateMoment = moment(date).set({ hour: 0, minute: 0, second: 1 });

      let fromDate = query.from;
      let toDate = moment(query.to, 'YYYY-MM-DD').isValid() ? query.to : moment();

      if (moment(toDate).isBefore(fromDate)) {
        toDate = query.from;
        fromDate = moment(query.to, 'YYYY-MM-DD').isValid() ? query.to : moment();
      }

      const fromDateMoment = moment(fromDate).set({ hour: 0, minute: 0, second: 0 });
      const toDateMoment = moment(toDate).set({ hour: 23, minute: 59, second: 59 });

      const isBetween = dateMoment.isBetween(fromDateMoment, toDateMoment);

      return isBetween;
    });
  }

  if (query.cameras) {
    const cameras = query.cameras.split(',');
    temperatures = temperatures.filter((temperature) => cameras.includes(temperature.cameraName));
  }

  if (query.presets) {
    const presets = query.presets.split(',');
    temperatures = temperatures.filter((temperature) => presets.includes(temperature.preset));
  }

  if (query.regions) {
    const regions = query.regions.split(',');
    temperatures = temperatures.filter((temperature) => regions.includes(temperature.region));
  }

  return temperatures;
};

export const listByCameraName = async (cameraName) => {
  let temperatures = await Database.interfaceDB.chain.get('temperatures').reverse().cloneDeep().value();

  if (temperatures) {
    temperatures = temperatures.filter((temperature) => temperature.cameraName === cameraName);
  }

  return temperatures;
};

export const findById = async (id) => {
  const temperature =
    (await Database.interfaceDB.chain.get('temperatures').find({ id: id }).cloneDeep().value()) ||
    Database.temperaturesDB.chain.get('temperatures').find({ id: id }).cloneDeep().value();

  return temperature;
};

export const createTemperature = async (data) => {
  const camera = await Database.interfaceDB.chain.get('cameras').find({ name: data.camera }).cloneDeep().value();
  //const camerasSettings = await Database.interfaceDB.chain.get('settings').get('cameras').cloneDeep().value();

  if (!camera) {
    throw new Error('Can not assign notification to camera!');
  }

  //const cameraSetting = camerasSettings.find((cameraSetting) => cameraSetting && cameraSetting.name === camera.name);

  const id = data.id || (await nanoid());
  const preset = data.preset;
  const region = data.preset;
  const timestamp = data.timestamp || moment().unix();
  const time = moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');

  const temperature = {
    id: id,
    camera: camera.name,
    region: region,
    preset: preset,
    time: time,
    timestamp: timestamp,
  };

  const temperartureSettings = await Database.interfaceDB.chain.get('settings').get('temperatures').cloneDeep().value();

  if (temperartureSettings.active) {
    //Check notification size, if we exceed more than {100} notifications, remove the latest
    const temperatureList = await Database.interfaceDB.chain.get('temperatures').cloneDeep().value();

    if (temperatureList.length > temperaturesLimit) {
      const diff = temperatureList.length - temperaturesLimit;
      const diffTemperatures = temperatureList.slice(-diff);

      for (const temperature of diffTemperatures) {
        Cleartimer.removeNotificationTimer(temperature.id);
      }

      await Database.interfaceDB.chain.get('temperatures').dropRight(temperatureList, diff).value();
    }

    await Database.interfaceDB.chain.get('temperatures').push(temperature).value();

    Cleartimer.setNotification(id, timestamp);
  }

  return {
    temperature: temperature,
  };
};

export const removeAll = async () => {
  //add timer for temperatures
  Cleartimer.stopNotifications();

  Database.temperaturesDB.chain
    .get('temperatures')
    .remove(() => true)
    .value();

  return await Database.interfaceDB.chain
    .get('temperatures')
    .remove(() => true)
    .value();
};
