'use-strict';

import moment from 'moment';
import { customAlphabet } from 'nanoid/async';

import Cleartimer from '../../../common/cleartimer.js';

import Database from '../../database.js';
import mongoose from 'mongoose';
const { Schema } = mongoose;

import {
  getAndStoreSnapshot,
  handleFragmentsRequests,
  storeBuffer,
  storeSnapshotFromVideo,
  storeVideo,
  storeVideoBuffer,
  convertToMp4,
} from '../../../common/ffmpeg.js';

mongoose.connect('mongodb://192.168.0.150:27017/infraspec', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const recordingSchema = new Schema({
  id: String,
  camera: String,
  fileName: String,
  name: String,
  extension: String,
  recordStoring: Boolean,
  recordType: String,
  room: String,
  time: String,
  date: { type: Date, expires: 604800 },
  timeStamp: Number,
  label: String,
});

const Recording = mongoose.model('Recording', recordingSchema);
await Recording.createCollection();

const nanoid = customAlphabet('1234567890abcdef', 10);

export const refresh = async () => {
  return await Database.refreshRecordingsDatabase();
};

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

  let recordings = await Recording.find({});

  recordings.sort(GetSortOrder('timeStamp'));

  if (moment(query.from, 'YYYY-MM-DD').isValid()) {
    recordings = recordings.filter((recording) => {
      const date = moment.unix(recording.timeStamp).format('YYYY-MM-DD');
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
  return Recording.find({ id: id });
};

export const createRecording = async (data, fileBuffer, skipffmpeg = false) => {
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

  const extension = data.extension;
  const label = (data.label || 'no label').toString();

  const recording = new Recording({
    id: id,
    camera: camera.name,
    fileName: `${fileName}.mp4`,
    name: fileName,
    extension: extension,
    recordStoring: true,
    recordType: data.type,
    trigger: data.trigger,
    room: room,
    time: time,
    date: Date.now(),
    timeStamp: timestamp,
    label: label,
  });

  console.log(recording);

  await storeSnapshotFromVideo(camera, data.path, fileName, label);

  await convertToMp4(camera, data.path, fileName);

  if (!skipffmpeg) {
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
  }

  recording.save();

  return recording;
};

export const removeById = async (id) => {
  Cleartimer.removeRecordingTimer(id);

  return await Recording.findOneAndDelete({ id: id });
};

export const removeAll = async () => {
  await Recording.deleteMany();
};
