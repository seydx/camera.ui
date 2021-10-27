'use-strict';

const moment = require('moment');
const { customAlphabet } = require('nanoid/async');
const nanoid = customAlphabet('1234567890abcdef', 10);

const { Cleartimer } = require('../../../common/cleartimer');

const { LoggerService } = require('../../../services/logger/logger.service');

const { Database } = require('../../database');

const { log } = LoggerService;

exports.list = async (query) => {
  let notifications = await Database.interfaceDB.get('notifications').reverse().value();

  if (moment(query.from, 'YYYY-MM-DD').isValid()) {
    notifications = notifications.filter((notification) => {
      let date = notification.time.split(',')[0].split('.');

      let year = date[2];
      let month = date[1];
      let day = date[0];

      date = year + '-' + month + '-' + day;

      let to = moment(query.to, 'YYYY-MM-DD').isValid() ? query.to : moment();

      let isBetween = moment(date).isBetween(query.from, to);

      return isBetween;
    });
  }

  if (query.cameras) {
    const cameras = query.cameras.split(',');
    notifications = notifications.filter((notification) => cameras.includes(notification.camera));
  }

  if (query.labels) {
    const labels = query.labels.split(',');
    notifications = notifications.filter((notification) => labels.includes(notification.label));
  }

  if (query.rooms) {
    const rooms = query.rooms.split(',');
    notifications = notifications.filter((notification) => rooms.includes(notification.room));
  }

  if (query.types) {
    const types = query.types.split(',');
    notifications = notifications.filter((notification) => types.includes(notification.recordType));
  }

  return notifications;
};

exports.listByCameraName = async (name) => {
  let notifications = await Database.interfaceDB.get('notifications').reverse().value();

  if (notifications) {
    notifications = notifications.filter((not) => not.camera === name);
  }

  return notifications;
};

exports.findById = async (id) => {
  return await Database.interfaceDB.get('notifications').find({ id: id }).value();
};

exports.createNotification = async (data) => {
  const camera = await Database.interfaceDB.get('cameras').find({ name: data.camera }).value();
  const cameraSettings = await Database.interfaceDB.get('settings').get('cameras').value();

  if (!camera) {
    throw new Error('Can not assign notification to camera!');
  }

  camera.settings = cameraSettings.find((cameraSetting) => cameraSetting && cameraSetting.name === camera.name);

  const id = data.id || (await nanoid());
  const cameraName = camera.name;
  const room = camera.settings ? camera.settings.room : 'Standard';
  const timestamp = data.timestamp || moment().unix();
  const time = moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');

  const fileName =
    cameraName.replace(/\s+/g, '_') +
    '-' +
    id +
    '-' +
    timestamp +
    (data.trigger === 'motion' ? '_m' : data.trigger === 'doorbell' ? '_d' : '_c') +
    '_CUI';

  const extension = data.type === 'Video' ? 'mp4' : 'jpeg';
  const storing = data.type === 'Video' || data.type === 'Snapshot';
  const label = (data.label || 'no label').toString();

  const notification = {
    id: id,
    camera: cameraName,
    fileName: `${fileName}.${extension}`,
    name: fileName,
    extension: extension,
    recordStoring: storing,
    recordType: data.type,
    trigger: data.trigger,
    room: room,
    time: time,
    timestamp: timestamp,
    label: label,
  };

  await Database.interfaceDB.get('notifications').push(notification).write();
  Cleartimer.setNotification(id, timestamp);

  const eventTxt = data.trigger.charAt(0).toUpperCase() + data.trigger.slice(1);

  log.notify({
    ...notification,
    title: cameraName,
    message: `${eventTxt} Event - ${time}`,
    subtxt: room,
    mediaSource: storing ? (data.type === 'Video' ? `/files/${fileName}@2.jpeg` : `${fileName}.${extension}`) : false,
    count: true,
    isNotification: true,
  });

  return notification;
};

exports.removeById = async (id) => {
  Cleartimer.removeNotificationTimer(id);

  return await Database.interfaceDB
    .get('notifications')
    .remove((not) => not.id === id)
    .write();
};

exports.removeAll = async () => {
  Cleartimer.stopNotifications();

  return await Database.interfaceDB
    .get('notifications')
    .remove(() => true)
    .write();
};
