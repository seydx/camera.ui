'use-strict';

const crypto = require('crypto');
const fs = require('fs-extra');
const moment = require('moment');
const path = require('path');
const piexif = require('piexifjs');
const { version } = require('../../package.json');
const webpush = require('web-push');

const low = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
const Memory = require('lowdb/adapters/Memory');

const { Cleartimer } = require('../common/cleartimer');

const { ConfigService } = require('../services/config/config.service');
const { LoggerService } = require('../services/logger/logger.service');

const { log } = LoggerService;

const defaultDatabase = {
  version: version,
  firstStart: true,
  cameras: [],
  notifications: [],
  users: [],
  settings: {
    aws: {
      active: false,
      accessKeyId: '',
      secretAccessKey: '',
      region: '',
      contingent_total: 5000,
      contingent_left: 5000,
      last_rekognition: '',
    },
    cameras: [],
    general: {
      atHome: false,
      exclude: [],
      rooms: ['Standard'],
      automation: {
        active: false,
        atHome: false,
        exclude: [],
        startTime: '08:00',
        endTime: '17:00',
      },
    },
    notifications: {
      active: false,
      removeAfter: 3,
      alexa: {
        active: false,
        domain: '',
        serialNr: '',
        message: '',
        startTime: '00:00',
        endTime: '23:59',
        auth: {
          cookie: '',
          macDms: {
            device_private_key: '',
            adp_token: '',
          },
        },
        proxy: {
          port: 9494,
        },
      },
      telegram: {
        active: false,
        token: '',
        chatID: '',
        message: '',
      },
      webhook: {
        active: false,
      },
    },
    recordings: {
      active: false,
      type: 'Snapshot',
      timer: 10,
      path: ConfigService.recordingsPath,
      removeAfter: 7,
    },
    webpush: {
      ...webpush.generateVAPIDKeys(),
      subscription: false,
    },
    widgets: {
      options: {
        locked: false,
      },
      items: [],
    },
  },
};

const defaultTokensDatabase = {
  tokens: [],
};

const defaultNotificationsDatabase = {
  notifications: [],
};

const defaultRecordingsDatabase = {
  path: path.join(process.env.CUI_STORAGE_PATH, 'recordings'),
  recordings: [],
};

class Database {
  static #cameras = ConfigService.ui.cameras;
  static #videoProcessor = ConfigService.ui.options.videoProcessor;

  static interfaceDB;
  static notificationsDB;
  static recordingsDB;
  static tokensDB;

  static databasePath = ConfigService.databasePath;
  static databaseUserPath = ConfigService.databaseUserPath;
  static recordingsPath = ConfigService.recordingsPath;
  static databaseFilePath = ConfigService.databaseFilePath;

  static controller;

  static atHomeAutomation = null;

  constructor(controller) {
    Database.controller = controller;
  }

  async prepareDatabase() {
    await fs.ensureFile(Database.databaseFilePath);
    await fs.ensureDir(Database.recordingsPath);
    await fs.ensureDir(Database.databaseUserPath);

    Database.interfaceDB = await low(new FileAsync(Database.databaseFilePath));
    Database.recordingsDB = low(new Memory());
    Database.notificationsDB = LoggerService.notificationsDB = low(new Memory()); //used for system events (errors)
    Database.tokensDB = low(new Memory());

    await Database.interfaceDB.defaults(defaultDatabase).write();
    Database.recordingsDB.defaults(defaultRecordingsDatabase).write();
    Database.notificationsDB.defaults(defaultNotificationsDatabase).write();
    Database.tokensDB.defaults(defaultTokensDatabase).write();

    await Database.#ensureDatabaseValues();
    await Database.#initializeUser();
    await Database.#writeConfigCamerasToDB();
    await Database.refreshRecordingsDatabase();

    await Database.interfaceDB.set('version', version).write();
    await Database.startAtHomeAutomation();
    await Cleartimer.start(Database.interfaceDB, Database.recordingsDB);

    return {
      interface: Database.interfaceDB,
    };
  }

  static async startAtHomeAutomation() {
    await Database.interfaceDB.read();

    const generalSettings = await Database.interfaceDB.get('settings').get('general').value();

    if (
      generalSettings.automation.active &&
      generalSettings.automation.startTime &&
      generalSettings.automation.endTime
    ) {
      log.debug('Starting atHome automation');

      const format = 'HH:mm';

      const oldAtHomeValue = generalSettings.atHome;
      const oldExcludeValue = generalSettings.exclude;

      const newAtHomeValue = generalSettings.automation.atHome;
      const newExcludeValue = generalSettings.automation.exclude;

      const adaptSettings = async (inTime) => {
        await Database.interfaceDB.read();

        await Database.interfaceDB
          .get('settings')
          .get('general')
          .set('atHome', inTime ? newAtHomeValue : oldAtHomeValue)
          .write();

        await Database.interfaceDB
          .get('settings')
          .get('general')
          .set('exclude', inTime ? newExcludeValue : oldExcludeValue)
          .write();
      };

      const isBetween = () => {
        const currentTime = moment();
        const startTime = moment(generalSettings.automation.startTime, format);
        const endTime = moment(generalSettings.automation.endTime, format);

        if ((startTime.hour() >= 12 && endTime.hour() <= 12) || endTime.isBefore(startTime)) {
          endTime.add(1, 'days');

          if (currentTime.hour() <= 12) {
            currentTime.add(1, 'days');
          }
        }

        return currentTime.isBetween(startTime, endTime);
      };

      Database.atHomeAutomation = setInterval(() => {
        adaptSettings(isBetween());
      }, 60 * 1000);

      adaptSettings(isBetween());
    }
  }

  static async restartAtHomeAutomation() {
    Database.stopAtHomeAutomation();
    await Database.startAtHomeAutomation();
  }

  static stopAtHomeAutomation() {
    log.debug('Stopping atHome automation');

    if (Database.atHomeAutomation) {
      clearInterval(Database.atHomeAutomation);
      Database.atHomeAutomation = null;
    }
  }

  static async refreshDatabase() {
    await Database.interfaceDB.read();
  }

  static async refreshRecordingsDatabase() {
    await Database.interfaceDB.read();

    Database.recordingsPath =
      (await Database.interfaceDB.get('settings').get('recordings').get('path').value()) || Database.recordingsPath;

    const cameras = await Database.interfaceDB.get('settings').get('cameras').value();

    await fs.ensureDir(Database.recordingsPath);

    const recordingsDirectory = (await fs.readdir(Database.recordingsPath)) || [];

    const recordings = recordingsDirectory
      .filter((rec) => rec && rec.includes('_CUI') && rec.endsWith('.jpeg'))
      .map((rec) => {
        let filePath = `${Database.recordingsPath}/${rec}`;

        let id = rec.split('-')[1]; //Test_Cam-c45747fbdf-1616771202_m_CUI / @2 / .jpeg
        let isPlaceholder = rec.endsWith('@2.jpeg');
        let fileName = isPlaceholder ? rec.split('@2')[0] : rec.split('.')[0];
        let extension = isPlaceholder ? 'mp4' : 'jpeg';
        let timestamp = rec.split('-')[2].split('_')[0];

        let cameraName = rec.split('-')[0].replace(/_/g, ' ');
        let cameraSetting = cameras.find((camera) => camera?.name === cameraName);

        const jpeg = fs.readFileSync(filePath);
        let exifPayload;
        let readableExifPayload = {};

        try {
          exifPayload = piexif.load(jpeg.toString('binary'));
        } catch (error) {
          log.debug(`Can not read exif data of ${rec}: ${error.message}`, false);
        }

        readableExifPayload = exifPayload ? Database.#getReadableExifPayload(exifPayload) : { label: 'no label' };

        return {
          id: id,
          camera: cameraName,
          fileName: `${fileName}.${extension}`,
          name: fileName,
          extension: extension,
          recordStoring: true,
          recordType: isPlaceholder ? 'Video' : 'Snapshot',
          trigger: rec.includes('_m') ? 'motion' : rec.includes('_d') ? 'doorbell' : 'custom',
          room: cameraSetting?.room || 'Standard',
          time: moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss'),
          timestamp: timestamp,
          label: readableExifPayload.label,
        };
      });

    Database.recordingsDB.setState({ path: Database.recordingsPath, recordings: recordings }).write();
  }

  static async resetDatabase() {
    return await Database.interfaceDB.setState(defaultDatabase).write();
  }

  static async #ensureDatabaseValues() {
    let database = await Database.interfaceDB.value();

    if (typeof database?.version !== 'string') {
      database.version = defaultDatabase.version;
    }

    if (typeof database?.firstStart !== 'boolean') {
      database.firstStart = defaultDatabase.firstStart;
    }

    if (!Array.isArray(database?.cameras)) {
      database.cameras = defaultDatabase.cameras;
    }

    if (!Array.isArray(database?.notifications)) {
      database.notifications = defaultDatabase.notifications;
    }

    if (!Array.isArray(database?.users)) {
      database.users = defaultDatabase.users;
    }

    if (typeof database?.settings !== 'object') {
      database.settings = defaultDatabase.settings;
    }

    if (typeof database?.settings.aws !== 'object') {
      database.settings.aws = defaultDatabase.settings.aws;
    }

    if (!Array.isArray(database?.settings.cameras)) {
      database.settings.cameras = defaultDatabase.settings.cameras;
    }

    if (typeof database?.settings.general !== 'object') {
      database.settings.general = defaultDatabase.settings.general;
    }

    if (typeof database?.settings.general.automation !== 'object') {
      database.settings.general.automation = defaultDatabase.settings.general.automation;
    }

    if (typeof database?.settings.notifications !== 'object') {
      database.settings.notifications = defaultDatabase.settings.notifications;
    }

    if (typeof database?.settings.notifications.alexa !== 'object') {
      database.settings.notifications.alexa = defaultDatabase.settings.notifications.alexa;
    }

    if (typeof database?.settings.notifications.telegram !== 'object') {
      database.settings.notifications.telegram = defaultDatabase.settings.notifications.telegram;
    }

    if (typeof database?.settings.notifications.webhook !== 'object') {
      database.settings.notifications.webhook = defaultDatabase.settings.notifications.webhook;
    }

    if (typeof database?.settings.recordings !== 'object') {
      database.settings.recordings = defaultDatabase.settings.recordings;
    }

    if (typeof database?.settings.webpush !== 'object') {
      database.settings.webpush = defaultDatabase.settings.webpush;
    }

    if (typeof database?.settings.widgets !== 'object') {
      database.settings.widgets = defaultDatabase.settings.widgets;
    }

    if (typeof database?.settings.widgets.options !== 'object') {
      database.settings.widgets.options = defaultDatabase.settings.widgets.options;
    }

    if (!Array.isArray(database?.settings.widgets.items)) {
      database.settings.widgets.items = defaultDatabase.settings.widgets.items;
    }

    await Database.interfaceDB.assign(database).write();
  }

  static async #initializeUser() {
    await Database.interfaceDB.read();

    const userEntries = await Database.interfaceDB.get('users').value();

    if (userEntries.length === 0) {
      let salt = crypto.randomBytes(16).toString('base64');
      let hash = crypto.createHmac('sha512', salt).update('master').digest('base64');

      const admin = {
        id: 1,
        username: 'master',
        password: salt + '$' + hash,
        sessionTimer: 14400, //4h
        photo: 'no_img.png',
        permissionLevel: ['admin'],
      };

      await Database.interfaceDB.get('users').push(admin).write();
    }
  }

  static async #writeConfigCamerasToDB() {
    await Database.interfaceDB.read();

    const Cameras = await Database.interfaceDB.get('cameras');
    const CamerasSettings = await Database.interfaceDB.get('settings').get('cameras');
    const CamerasWidgets = await Database.interfaceDB.get('settings').get('widgets').get('items');

    await Cameras.remove((x) => Database.#cameras.filter((y) => y && y.name === x.name).length === 0).write();
    await CamerasSettings.remove((x) => Database.#cameras.filter((y) => y && y.name === x.name).length === 0).write();
    await CamerasWidgets.remove(
      (x) => x.type === 'CamerasWidget' && Database.#cameras.filter((y) => y && y.name === x.id).length === 0
    ).write();

    for (const cam of Database.#cameras) {
      const camera = {
        name: cam.name,
        recordOnMovement: cam.recordOnMovement,
        motionTimeout: cam.motionTimeout,
        prebuffering: cam.prebuffering,
        videoConfig: cam.videoConfig,
      };

      const cameraExists = await CamerasSettings.find({ name: cam.name }).value();

      await (cameraExists ? Cameras.find({ name: cam.name }).assign(camera).write() : Cameras.push(camera).write());

      if (!cameraExists) {
        const cameraraSettingsEntry = {
          name: cam.name,
          room: 'Standard',
          resolution: '1280x720',
          pingTimeout: 1,
          streamTimeout: 60,
          audio: false,
          telegramType: 'Snapshot',
          alexa: false,
          webhookUrl: '',
          privacyMode: false,
          camview: {
            favourite: true,
            live: true,
            snapshotTimer: 60,
          },
          dashboard: {
            live: true,
            snapshotTimer: 60,
          },
          rekognition: {
            active: false,
            confidence: 90,
            labels: [],
          },
        };

        await CamerasSettings.push(cameraraSettingsEntry).write();
      }
    }
  }

  static #getReadableExifPayload(exifPayload) {
    exifPayload = exifPayload || {};

    const title = 40091;
    const comment = 40092;
    const author = 40093;

    const payload = exifPayload['0th'] || {};

    return {
      camera: payload[title] ? Buffer.from(payload[title]).toString().replace(/\0/g, '') : 'Camera',
      label: payload[comment] ? Buffer.from(payload[comment]).toString().replace(/\0/g, '') : 'no label',
      author: payload[author] ? Buffer.from(payload[author]).toString().replace(/\0/g, '') : 'camera.ui',
    };
  }
}

exports.Database = Database;
