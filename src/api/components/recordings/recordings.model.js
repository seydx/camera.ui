'use-strict';

import fs from 'fs-extra';
import moment from 'moment';
import { customAlphabet } from 'nanoid/async';

import Cleartimer from '../../../common/cleartimer.js';

import Database from '../../database.js';
import Socket from '../../socket.js';

import {
  getAndStoreSnapshot,
  handleFragmentsRequests,
  storeBuffer,
  storeSnapshotFromVideo,
  storeVideo,
  storeVideoBuffer,
} from '../../../common/ffmpeg.js';

const nanoid = customAlphabet('1234567890abcdef', 10);

export const refresh = async () => {
  return await Database.refreshRecordingsDatabase();
};

export const list = (query) => {
  let recordings = Database.recordingsDB.chain.get('recordings').cloneDeep().value();

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

  recordings.sort(GetSortOrder('timestamp'));

  if (moment(query.from, 'YYYY-MM-DD').isValid()) {
    recordings = recordings.filter((recording) => {
      const date = moment.unix(recording.timestamp).format('YYYY-MM-DD');
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

export const listByCameraName = (name) => {
  let recordings = Database.recordingsDB.chain.get('recordings').reverse().cloneDeep().value();

  if (recordings) {
    recordings = recordings.filter((rec) => rec.camera === name);
  }

  return recordings;
};

export const findById = (id) => {
  return Database.recordingsDB.chain.get('recordings').find({ id: id }).cloneDeep().value();
};

export const createRecording = async (data, fileBuffer) => {
  const camera = await Database.interfaceDB.chain.get('cameras').find({ name: data.camera }).cloneDeep().value();

  if (!camera) {
    throw new Error('Can not assign recording to camera!');
  }

  const camerasSettings = await Database.interfaceDB.chain.get('settings').get('cameras').cloneDeep().value();
  const recordingsSettings = await Database.interfaceDB.chain.get('settings').get('recordings').cloneDeep().value();

  const cameraSetting = camerasSettings.find((cameraSetting) => cameraSetting && cameraSetting.name === camera.name);

  const id = data.id || (await nanoid());
  const room = cameraSetting ? cameraSetting.room : 'Standard';
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
    room: room,
    time: time,
    timestamp: timestamp,
    label: label,
  };

  if (fileBuffer) {
    await storeVideoBuffer(camera, fileBuffer, data.path, fileName);
    await storeSnapshotFromVideo(camera, data.path, fileName, label);
  } else {
    const isPlaceholder = data.type === 'Video';
    const externRecording = false;
    const storeSnapshot = true;

    // eslint-disable-next-line unicorn/prefer-ternary
    if (data.imgBuffer) {
      await storeBuffer(camera, data.imgBuffer, data.path, fileName, label, isPlaceholder, externRecording);
    } else {
      await getAndStoreSnapshot(camera, false, data.path, fileName, label, isPlaceholder, storeSnapshot);
    }

    if (data.type === 'Video') {
      if (camera.prebuffering) {
        let filebuffer = Buffer.alloc(0);

        let generator = handleFragmentsRequests(camera);

        setTimeout(async () => {
          if (generator) {
            generator.throw();
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

  Database.recordingsDB.chain.push(recording).value();

  Socket.io.emit('recording', recording);

  Cleartimer.setRecording(id, timestamp);

  return recording;
};

export const removeById = async (id) => {
  const recPath = Database.recordingsDB.chain.get('path').cloneDeep().value();

  const recording = Database.recordingsDB.chain
    .get('recordings')
    .find((rec) => rec.id === id)
    .cloneDeep()
    .value();

  if (recording) {
    await fs.remove(recPath + '/' + recording.fileName);

    if (recording.recordType === 'Video') {
      let placehoalder = recording.fileName.split('.')[0] + '@2.jpeg';
      await fs.remove(recPath + '/' + placehoalder);
    }
  }

  Cleartimer.removeRecordingTimer(id);

  return Database.recordingsDB.chain
    .get('recordings')
    .remove((rec) => rec.id === id)
    .value();
};

export const removeAll = async () => {
  const recPath = Database.recordingsDB.chain.get('path').cloneDeep().value();

  await fs.emptyDir(recPath);
  Cleartimer.stopRecordings();

  return Database.recordingsDB.chain
    .get('recordings')
    .remove(() => true)
    .value();
};
