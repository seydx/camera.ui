'use-strict';

import moment from 'moment';
import { customAlphabet } from 'nanoid/async';

import Cleartimer from '../../../common/cleartimer.js';
import ConfigService from '../../../services/config/config.service.js';

import Database from '../../database.js';

import mongoose from 'mongoose';
const { Schema } = mongoose;

mongoose.connect(`mongodb://${ConfigService.ui.options.host}:27017/infraspec`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const temperatureSchema = new Schema({
  id: String,
  camera: String,
  region: String,
  preset: String,
  maxTemp: String,
  minTemp: String,
  avgTemp: String,
  date: { type: Date, expires: 604800 },
  time: String,
  timeStamp: Number,
});

const Temperature = mongoose.model('Temperature', temperatureSchema);

const nanoid = customAlphabet('1234567890abcdef', 10);

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

  let temperatures = await Temperature.find({
    date: {
      $gte: new Date(moment(query.from, 'YYYY-MM-DD')),
      $lte: new Date(moment(query.to, 'YYYY-MM-DD')),
    },
    preset: `/[${query.presets}]/`,
    camera: `/${query.cameras}/`,
  });

  //let temperatures = await Database.interfaceDB.chain.get('temperatures').cloneDeep().value();
  // temperatures.push(...Database.temperaturesDB.chain.get('temperatures').cloneDeep().value());
  await temperatures.push(...(await Temperature.find()));
  temperatures.sort(GetSortOrder('timeStamp'));

  if (moment(query.from, 'YYYY-MM-DD').isValid()) {
    temperatures = temperatures.filter((temperature) => {
      const date = moment.unix(temperature.timeStamp).format('YYYY-MM-DD');
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
    temperatures = temperatures.filter((temperature) => cameras.includes(temperature.camera));
  }

  if (query.presets) {
    const presets = query.presets.split(',');
    temperatures = temperatures.filter((temperature) => temperature.preset.includes(`[${presets[0]}]`));
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
  const camera = await Database.interfaceDB.chain.get('cameras').find({ name: data.cameraName }).cloneDeep().value();
  //const camerasSettings = await Database.interfaceDB.chain.get('settings').get('cameras').cloneDeep().value();

  if (!camera) {
    throw new Error('Can not create temp for camera!');
  }

  //const cameraSetting = camerasSettings.find((cameraSetting) => cameraSetting && cameraSetting.name === camera.name);

  const id = data.id || (await nanoid());
  const preset = data.presetId;
  const region = data.regionId;
  const timestamp = data.timestamp || moment().unix();
  const time = moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');

  const temperature = new Temperature({
    id: id,
    camera: camera.name,
    region: region,
    preset: preset,
    minTemp: data.minTemp,
    maxTemp: data.maxTemp,
    avgTemp: data.avgTemp,
    date: Date.now(),
    time: time,
    timeStamp: timestamp,
  });

  //Loop back to setup temp settings for total number of temp readings. Will want to convert this to a time range i.e Remove all temp data older than 30 days.
  // const temperartureSettings = await Database.interfaceDB.chain.get('settings').get('temperatures').cloneDeep().value();

  // if (temperartureSettings.active) {
  //   //Check notification size, if we exceed more than {100} notifications, remove the latest
  //   const temperatureList = await Database.interfaceDB.chain.get('temperatures').cloneDeep().value();

  //   if (temperatureList.length > temperaturesLimit) {
  //     const diff = temperatureList.length - temperaturesLimit;
  //     const diffTemperatures = temperatureList.slice(-diff);

  //     for (const temperature of diffTemperatures) {
  //       Cleartimer.removeNotificationTimer(temperature.id);
  //     }

  //     await Database.interfaceDB.chain.get('temperatures').dropRight(temperatureList, diff).value();
  //   }

  //   await Database.interfaceDB.chain.get('temperatures').push(temperature).value();

  //   Cleartimer.setNotification(id, timestamp);
  // }
  temperature.save();
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
