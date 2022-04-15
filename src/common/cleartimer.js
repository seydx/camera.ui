'use-strict';

import fs from 'fs-extra';
import moment from 'moment';

import LoggerService from '../services/logger/logger.service.js';

const { log } = LoggerService;

export default class Cleartimer {
  static #interfaceDB;
  static #recordingsDB;

  static #notificationsTimer = new Map();
  static #recordingsTimer = new Map();

  constructor() {}

  static async start(interfaceDB, recordingsDB) {
    if (interfaceDB) {
      Cleartimer.#interfaceDB = interfaceDB;
    }

    if (recordingsDB) {
      Cleartimer.#recordingsDB = recordingsDB;
    }

    try {
      //log.debug('Initializing clear timer');

      const notSettings = await Cleartimer.#interfaceDB.chain.get('settings').get('notifications').cloneDeep().value();
      const notRemoveAfter = notSettings.removeAfter;

      if (notRemoveAfter > 0) {
        const notifications = await Cleartimer.#interfaceDB.chain.get('notifications').cloneDeep().value();

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
      }

      const recSettings = await Cleartimer.#interfaceDB.chain.get('settings').get('recordings').cloneDeep().value();
      const recRemoveAfter = recSettings.removeAfter;

      if (recRemoveAfter) {
        const recordings = Cleartimer.#recordingsDB.chain.get('recordings').cloneDeep().value();

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
      }
    } catch (error) {
      log.info('An error occured during starting clear timer', 'Cleartimer', 'interface');
      log.error(error, 'Cleartimer', 'interface');
    }
  }

  static stop() {
    Cleartimer.stopNotifications();
    Cleartimer.stopRecordings();
  }

  static async startNotifications() {
    try {
      const notSettings = await Cleartimer.#interfaceDB.chain.get('settings').get('notifications').cloneDeep().value();
      const notRemoveAfter = notSettings.removeAfter;

      if (notRemoveAfter > 0) {
        const notifications = await Cleartimer.#interfaceDB.chain.get('notifications').cloneDeep().value();

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
      }
    } catch (error) {
      log.info('An error occured during starting notifications clear timer', 'Cleartimer', 'interface');
      log.error(error, 'Cleartimer', 'interface');
    }
  }

  static async startRecordings() {
    try {
      const recSettings = await Cleartimer.#interfaceDB.chain.get('settings').get('recordings').cloneDeep().value();
      const recRemoveAfter = recSettings.removeAfter;

      if (recRemoveAfter) {
        const recordings = Cleartimer.#recordingsDB.chain.get('recordings').cloneDeep().value();

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
      }
    } catch (error) {
      log.info('An error occured during starting clear timer', 'Cleartimer', 'interface');
      log.error(error, 'Cleartimer', 'interface');
    }
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
      const settings = await Cleartimer.#interfaceDB.chain.get('settings').get('notifications').cloneDeep().value();
      const clearTimer = settings.removeAfter;

      Cleartimer.#timeout(clearTimer, 'hours', id, timestamp, false);
    } catch (error) {
      log.info(`An error occured during setting up cleartimer for notification (${id})`, 'Cleartimer', 'interface');
      log.error(error, 'Cleartimer', 'interface');
    }
  }

  static async setRecording(id, timestamp) {
    try {
      const settings = await Cleartimer.#interfaceDB.chain.get('settings').get('recordings').cloneDeep().value();
      const clearTimer = settings.removeAfter;

      Cleartimer.#timeout(clearTimer, 'days', id, timestamp, true);
    } catch (error) {
      log.info(`An error occured during setting up cleartimer for recording (${id})`, 'Cleartimer', 'interface');
      log.error(error, 'Cleartimer', 'interface');
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
        log.debug(`Clear timer for notification (${id}) reached`);

        await Cleartimer.#interfaceDB.chain
          .get('notifications')
          .remove((not) => not.id === id)
          .value();
      }
    } catch (error) {
      log.info(`An error occured during removing notification (${id}) due to cleartimer`, 'Cleartimer', 'interface');
      log.error(error, 'Cleartimer', 'interface');
    }
  }

  static async #clearRecording(id) {
    try {
      if (Cleartimer.#recordingsTimer.has(id)) {
        log.debug(`Clear timer for recording (${id}) reached`);

        const recPath = Cleartimer.#recordingsDB.chain.get('path').cloneDeep().value();

        const recording = Cleartimer.#recordingsDB.chain
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

        Cleartimer.#recordingsDB.chain
          .get('recordings')
          .remove((rec) => rec.id === id)
          .value();
      }
    } catch (error) {
      log.info(`An error occured during removing recording (${id}) due to cleartimer`, 'Cleartimer', 'interface');
      log.error(error, 'Cleartimer', 'interface');
    }
  }

  static #timeout(timeValue, timeTyp, id, timestamp, isRecording) {
    if (timeValue) {
      const endTime = moment.unix(timestamp).add(timeValue, timeTyp);

      /*log.debug(
        `SET cleartimer for ${
          isRecording ? 'Recording' : 'Notification'
        } (${id}) - Removing after ${timeValue} ${timeTyp} - Endtime: ${endTime}`
      );*/

      const interval = isRecording ? 6 * 60 * 60 * 1000 : 30 * 60 * 1000;

      const timer = setInterval(async () => {
        const now = moment();

        if (now > endTime) {
          await (isRecording ? Cleartimer.#clearRecording(id) : Cleartimer.#clearNotification(id));
          clearInterval(timer);
        }
      }, interval);

      if (isRecording) {
        Cleartimer.#recordingsTimer.set(id, timer);
      } else {
        Cleartimer.#notificationsTimer.set(id, timer);
      }
    }
  }
}
