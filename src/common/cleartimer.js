'use-strict';

const fs = require('fs-extra');
const moment = require('moment');

const { LoggerService } = require('../services/logger/logger.service');

const { log } = LoggerService;

class Cleartimer {
  static #interfaceDB;
  static #recordingsDB;

  static #notificationsTimer = new Map();
  static #recordingsTimer = new Map();

  constructor() {}

  static async start(interfaceDB, recordingsDB) {
    Cleartimer.#interfaceDB = interfaceDB;
    Cleartimer.#recordingsDB = recordingsDB;

    try {
      //log.debug('Initializing clear timer');

      await Cleartimer.#interfaceDB.read();

      const notifications = await Cleartimer.#interfaceDB.get('notifications').value();
      const recordings = Cleartimer.#recordingsDB.get('recordings').value();

      const recSettings = await Cleartimer.#interfaceDB.get('settings').get('recordings').value();
      const recRemoveAfter = recSettings.removeAfter;

      const notSettings = await Cleartimer.#interfaceDB.get('settings').get('notifications').value();
      const notRemoveAfter = notSettings.removeAfter;

      for (const notification of notifications) {
        let timestampNow = moment();
        let timestampFile = moment(moment.unix(notification.timestamp));
        let timestampDif = timestampNow.diff(timestampFile, 'minutes');

        let removeAfterTimer = notRemoveAfter * 60;

        if (removeAfterTimer > timestampDif) {
          removeAfterTimer -= timestampDif;
        }

        if (timestampDif > notRemoveAfter * 60) {
          Cleartimer.#notificationsTimer.set(notification.id, false);
          await Cleartimer.#clearNotification(notification.id);
        } else {
          Cleartimer.#timeout(removeAfterTimer / 60, 'hours', notification.id, notification.timestamp, false);
        }
      }

      for (const recording of recordings) {
        let timestampNow = moment();
        let timestampFile = moment(moment.unix(recording.timestamp));
        let timestampDif = timestampNow.diff(timestampFile, 'hours');

        let removeAfterTimer = recRemoveAfter * 24;

        if (removeAfterTimer > timestampDif) {
          removeAfterTimer -= timestampDif;
        }

        if (timestampDif > recRemoveAfter * 24) {
          Cleartimer.#recordingsTimer.set(recording.id, false);
          await Cleartimer.#clearRecording(recording.id);
        } else {
          Cleartimer.#timeout(removeAfterTimer / 24, 'days', recording.id, recording.timestamp, true);
        }
      }
    } catch (error) {
      log.error('An error occured during starting clear timer');
      log.error(error);
    }
  }

  static stop() {
    Cleartimer.stopNotifications();
    Cleartimer.stopRecordings();
  }

  static stopNotifications() {
    for (const entry of Cleartimer.#notificationsTimer.entries()) {
      const id = entry[0];
      const timer = entry[1];

      clearInterval(timer);
      Cleartimer.#notificationsTimer.delete(id);
    }
  }

  static stopRecordings() {
    for (const entry of Cleartimer.#recordingsTimer.entries()) {
      const id = entry[0];
      const timer = entry[1];

      clearInterval(timer);
      Cleartimer.#recordingsTimer.delete(id);
    }
  }

  static async setNotification(id, timestamp) {
    try {
      await Cleartimer.#interfaceDB.read();

      const settings = await Cleartimer.#interfaceDB.get('settings').get('notifications').value();
      const clearTimer = settings.removeAfter;

      Cleartimer.#timeout(clearTimer, 'hours', id, timestamp, false);
    } catch (error) {
      log.error(`An error occured during setting up cleartimer for notification (${id})`);
      log.error(error);
    }
  }

  static async setRecording(id, timestamp) {
    try {
      await Cleartimer.#interfaceDB.read();

      const settings = await Cleartimer.#interfaceDB.get('settings').get('recordings').value();
      const clearTimer = settings.removeAfter;

      Cleartimer.#timeout(clearTimer, 'days', id, timestamp, true);
    } catch (error) {
      log.error(`An error occured during setting up cleartimer for recording (${id})`);
      log.error(error);
    }
  }

  static removeNotificationTimer(id) {
    if (Cleartimer.#notificationsTimer.has(id)) {
      const timer = Cleartimer.#notificationsTimer.get(id);

      clearInterval(timer);
      Cleartimer.#notificationsTimer.delete(id);
    }
  }

  static removeRecordingTimer(id) {
    if (Cleartimer.#recordingsTimer.has(id)) {
      const timer = Cleartimer.#recordingsTimer.get(id);

      clearInterval(timer);
      Cleartimer.#recordingsTimer.delete(id);
    }
  }

  static async #clearNotification(id) {
    try {
      if (Cleartimer.#notificationsTimer.has(id)) {
        await Cleartimer.#interfaceDB.read();

        log.debug(`Clear timer for notification (${id}) reached`);

        await Cleartimer.#interfaceDB
          .get('notifications')
          .remove((not) => not.id === id)
          .write();
      }
    } catch (error) {
      log.error(`An error occured during removing notification (${id}) due to cleartimer`);
      log.error(error);
    }
  }

  static async #clearRecording(id) {
    try {
      if (Cleartimer.#recordingsTimer.has(id)) {
        log.debug(`Clear timer for recording (${id}) reached`);

        const recPath = Cleartimer.#recordingsDB.get('path').value();

        const recording = Cleartimer.#recordingsDB
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

        Cleartimer.#recordingsDB
          .get('recordings')
          .remove((rec) => rec.id === id)
          .write();
      }
    } catch (error) {
      log.error(`An error occured during removing recording (${id}) due to cleartimer`);
      log.error(error);
    }
  }

  static #timeout(timeValue, timeTyp, id, timestamp, isRecording) {
    const endTime = moment.unix(timestamp).add(timeValue, timeTyp);

    //log.debug(`SET cleartimer for ${isRecording ? 'Recording' : 'Notification'} (${id}) - Endtime: ${endTime}`);

    const interval = isRecording ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;

    const timer = setInterval(async () => {
      const now = moment();

      if (now > endTime) {
        clearInterval(timer);
        await (isRecording ? Cleartimer.#clearRecording(id) : Cleartimer.#clearNotification(id));
      }
    }, interval);

    if (isRecording) {
      Cleartimer.#recordingsTimer.set(id, timer);
    } else {
      Cleartimer.#notificationsTimer.set(id, timer);
    }
  }
}

exports.Cleartimer = Cleartimer;
