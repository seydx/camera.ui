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

const { ConfigService } = require('../services/config/config.service');
const { LoggerService } = require('../services/logger/logger.service');

const { log } = LoggerService;

const defaultDatabase = {
  version: version,
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
    camview: {
      refreshTimer: 60,
    },
    dashboard: {
      refreshTimer: 60,
    },
    general: {
      atHome: false,
      theme: 'default',
      exclude: [],
      rooms: ['Standard'],
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
  },
};

const defaultTokensDatabase = {
  tokens: [],
};

const defaultRecordingsDatabase = {
  path: path.join(process.env.CUI_STORAGE_PATH, 'recordings'),
  recordings: [],
};

class Database {
  static #cameras = ConfigService.ui.cameras;
  static #videoProcessor = ConfigService.ui.options.videoProcessor;

  static interfaceDB;
  static recordingsDB;
  static tokensDB;

  static databasePath = ConfigService.databasePath;
  static databaseUserPath = ConfigService.databaseUserPath;
  static recordingsPath = ConfigService.recordingsPath;
  static databaseFilePath = ConfigService.databaseFilePath;

  constructor() {}

  async prepareDatabase() {
    await fs.ensureFile(Database.databaseFilePath);
    await fs.ensureDir(Database.recordingsPath);
    await fs.ensureDir(Database.databaseUserPath);

    Database.interfaceDB = await low(new FileAsync(Database.databaseFilePath));
    Database.recordingsDB = low(new Memory());
    Database.tokensDB = low(new Memory());

    await Database.interfaceDB.defaults(defaultDatabase).write();
    Database.recordingsDB.defaults(defaultRecordingsDatabase).write();
    Database.tokensDB.defaults(defaultTokensDatabase).write();

    await Database.#initializeUser();
    await Database.#writeConfigCamerasToDB();
    await Database.refreshRecordingsDatabase();
  }

  static async refreshDatabase() {
    await Database.interfaceDB.read();
  }

  static async refreshRecordingsDatabase() {
    Database.recordingsPath =
      (await Database.interfaceDB.get('settings').get('recordings').get('path').value()) || Database.recordingsPath;

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
        let cameraSetting = Database.interfaceDB.get('settings').get('cameras').find({ name: cameraName }).value();

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
          room: cameraSetting ? cameraSetting.room : 'Standard',
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

  static async #initializeUser() {
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
    const Cameras = Database.interfaceDB.get('cameras');
    const CamerasSettings = Database.interfaceDB.get('settings').get('cameras');

    await Cameras.remove((x) => Database.#cameras.filter((y) => y && y.name === x.name).length === 0).write();
    await CamerasSettings.remove((x) => Database.#cameras.filter((y) => y && y.name === x.name).length === 0).write();

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
          audio: false,
          telegramType: '',
          alexa: 'Disabled',
          webhookUrl: '',
          camview: {
            favourite: true,
            live: true,
            expand: true,
          },
          dashboard: {
            favourite: true,
            live: true,
            expand: true,
          },
          rekognition: {
            active: false,
            confidence: 90,
            labels: [''],
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
