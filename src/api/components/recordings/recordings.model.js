'use-strict';

const fs = require('fs-extra');
const moment = require('moment');
const { customAlphabet } = require('nanoid/async');
const nanoid = customAlphabet('1234567890abcdef', 10);

const { Cleartimer } = require('../../../common/cleartimer');

const { Database } = require('../../database');
const { Socket } = require('../../socket');

const {
  getAndStoreSnapshot,
  handleFragmentsRequests,
  storeBuffer,
  storeVideo,
  storeVideoBuffer,
} = require('../../../common/ffmpeg');

exports.refresh = async () => {
  return await Database.refreshRecordingsDatabase();
};

exports.list = (query) => {
  let recordings = Database.recordingsDB.get('recordings').value();

  recordings.sort((x, y) => y.timestamp - x.timestamp);

  if (moment(query.from, 'YYYY-MM-DD').isValid()) {
    recordings = recordings.filter((recording) => {
      let date = recording.time.split(',')[0].split('.');

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
    recordings = recordings.filter((recording) => cameras.includes(recording.camera));
  }

  if (query.labels) {
    const labels = query.labels.split(',');
    recordings = recordings.filter((recording) => labels.includes(recording.label));
  }

  if (query.rooms) {
    const rooms = query.rooms.split(',');
    recordings = recordings.filter((recording) => rooms.includes(recording.room));
  }

  if (query.types) {
    const types = query.types.split(',');
    recordings = recordings.filter((recording) => types.includes(recording.recordType));
  }

  return recordings;
};

exports.listByCameraName = (name) => {
  let recordings = Database.recordingsDB.get('recordings').reverse().value();

  if (recordings) {
    recordings = recordings.filter((rec) => rec.camera === name);
  }

  return recordings;
};

exports.findById = (id) => {
  return Database.recordingsDB.get('recordings').find({ id: id }).value();
};

exports.createRecording = async (data, fileBuffer) => {
  await Database.interfaceDB.read();

  const camera = await Database.interfaceDB.get('cameras').find({ name: data.camera }).value();

  if (!camera) {
    throw new Error('Can not assign recording to camera!');
  }

  const cameraSettings = await Database.interfaceDB.get('settings').get('cameras').value();
  const recordingsSettings = await Database.interfaceDB.get('settings').get('recordings').value();

  camera.settings = cameraSettings.find((cameraSetting) => cameraSetting && cameraSetting.name === camera.name);

  const id = data.id || (await nanoid());
  const timestamp = data.timestamp || moment().unix();
  const time = moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');

  const fileName =
    camera.name.replace(/\s+/g, '_') +
    '-' +
    id +
    '-' +
    timestamp +
    (data.trigger === 'motion' ? '_m' : data.trigger === 'doorbell' ? '_d' : '_c') +
    '_CUI';

  const extension = data.type === 'Video' ? 'mp4' : 'jpeg';
  const label = (data.label || 'no label').toString();

  const recording = {
    id: id,
    camera: camera.name,
    fileName: `${fileName}.${extension}`,
    name: fileName,
    extension: extension,
    recordStoring: true,
    recordType: data.type,
    trigger: data.trigger,
    room: camera.settings.room,
    time: time,
    timestamp: timestamp,
    label: label,
  };

  if (fileBuffer) {
    const isPlaceholder = true;
    const externRecording = true;

    await storeBuffer(camera, fileBuffer, data.path, fileName, label, isPlaceholder, externRecording);
    await storeVideoBuffer(camera, fileBuffer, data.path, fileName);
  } else {
    const isPlaceholder = data.type === 'Video';
    const externRecording = false;
    const storeSnapshot = true;

    // eslint-disable-next-line unicorn/prefer-ternary
    if (data.imgBuffer) {
      await storeBuffer(camera, data.imgBuffer, data.path, fileName, label, isPlaceholder, externRecording);
    } else {
      await getAndStoreSnapshot(camera, data.path, fileName, label, isPlaceholder, storeSnapshot);
    }

    if (data.type === 'Video') {
      if (camera.prebuffering) {
        let filebuffer = Buffer.alloc(0);

        let generator = handleFragmentsRequests(camera);

        setTimeout(async () => {
          if (generator) {
            generator.throw('dataSend close (ui)');
          }
        }, recordingsSettings.timer * 1000);

        for await (const fileBuffer of generator) {
          filebuffer = Buffer.concat([filebuffer, Buffer.concat(fileBuffer)]);
        }

        generator = null;

        await storeVideoBuffer(camera, filebuffer, data.path, fileName);
      } else {
        await storeVideo(camera, data.path, fileName, data.timer);
      }
    }
  }

  Database.recordingsDB.push(recording).write();

  Socket.io.emit('recording', recording);

  Cleartimer.setRecording(id, timestamp);

  return recording;
};

exports.removeById = async (id) => {
  const recPath = Database.recordingsDB.get('path').value();

  const recording = Database.recordingsDB
    .get('recordings')
    .find((rec) => rec.id === id)
    .value();

  if (recording) {
    await fs.remove(recPath + '/' + recording.fileName);

    if (recording.recordType === 'Video') {
      let placehoalder = recording.fileName.split('.')[0] + '@2.jpeg';
      await fs.remove(recPath + '/' + placehoalder);
    }
  }

  Cleartimer.removeRecordingTimer(id);

  return Database.recordingsDB
    .get('recordings')
    .remove((rec) => rec.id === id)
    .write();
};

exports.removeAll = async () => {
  const recPath = Database.recordingsDB.get('path').value();

  await fs.emptyDir(recPath);
  Cleartimer.stopRecordings();

  return Database.recordingsDB
    .get('recordings')
    .remove(() => true)
    .write();
};
