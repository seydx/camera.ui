'use-strict';

const moment = require('moment');
const { customAlphabet } = require('nanoid/async');
const nanoid = customAlphabet('1234567890abcdef', 10);

const { Cleartimer } = require('../../../common/cleartimer');

const { Database } = require('../../database');

const notificationsLimit = 100;

exports.list = async (query) => {
  await Database.interfaceDB.read();

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

  let notifications = await Database.interfaceDB.get('notifications').value();
  notifications.push(...Database.notificationsDB.get('notifications').value());
  notifications.sort(GetSortOrder('timestamp'));

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
    notifications = notifications.filter(
      (notification) => cameras.includes(notification.camera) || cameras.includes(notification.title)
    );
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
    notifications = notifications.filter(
      (notification) => types.includes(notification.recordType) || types.includes(notification.type)
    );
  }

  return notifications;
};

exports.listByCameraName = async (name) => {
  await Database.interfaceDB.read();

  let notifications = await Database.interfaceDB.get('notifications').reverse().value();

  if (notifications) {
    notifications = notifications.filter((not) => not.camera === name);
  }

  return notifications;
};

exports.findById = async (id) => {
  await Database.interfaceDB.read();

  const notification =
    (await Database.interfaceDB.get('notifications').find({ id: id }).value()) ||
    Database.notificationsDB.get('notifications').find({ id: id }).value();

  return notification;
};

exports.createNotification = async (data) => {
  await Database.interfaceDB.read();

  const camera = await Database.interfaceDB.get('cameras').find({ name: data.camera }).value();
  const camerasSettings = await Database.interfaceDB.get('settings').get('cameras').value();

  if (!camera) {
    throw new Error('Can not assign notification to camera!');
  }

  //Check notification size, if we exceed more than {100} notifications, remove the latest
  const notificationList = await Database.interfaceDB.get('notifications').value();

  if (notificationList.length > notificationsLimit) {
    const diff = notificationList.length - notificationsLimit;
    await Database.interfaceDB.get('notifications').dropRight(notificationList, diff).write();
  }

  const cameraSetting = camerasSettings.find((cameraSetting) => cameraSetting && cameraSetting.name === camera.name);

  const id = data.id || (await nanoid());
  const cameraName = camera.name;
  const room = cameraSetting ? cameraSetting.room : 'Standard';
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

  const notify = {
    ...notification,
    title: cameraName,
    message: `${data.trigger} - ${time}`,
    subtxt: room,
    mediaSource: storing ? `/files/${fileName}.${extension}` : false,
    tumbnail: storing
      ? data.type === 'Video'
        ? `/files/${fileName}@2.jpeg`
        : `/files/${fileName}.${extension}`
      : false,
    count: true,
    isNotification: true,
  };

  return {
    notification: notification,
    notify: notify,
  };
};

exports.removeById = async (id) => {
  await Database.interfaceDB.read();

  Cleartimer.removeNotificationTimer(id);

  Database.notificationsDB
    .get('notifications')
    .remove((not) => not.id === id)
    .write();

  return await Database.interfaceDB
    .get('notifications')
    .remove((not) => not.id === id)
    .write();
};

exports.removeAll = async () => {
  await Database.interfaceDB.read();

  Cleartimer.stopNotifications();

  Database.notificationsDB
    .get('notifications')
    .remove(() => true)
    .write();

  return await Database.interfaceDB
    .get('notifications')
    .remove(() => true)
    .write();
};
