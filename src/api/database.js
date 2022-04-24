'use-strict';

import crypto from 'crypto';
import fs from 'fs-extra';
import lodash from 'lodash';
import moment from 'moment';
import path from 'path';
import piexif from 'piexifjs';
import webpush from 'web-push';
import { Low, JSONFile, MemorySync } from '@seydx/lowdb';

import Socket from './socket.js';

import Cleartimer from '../common/cleartimer.js';

import ConfigService from '../services/config/config.service.js';
import LoggerService from '../services/logger/logger.service.js';

const { log } = LoggerService;

const defaultDatabase = {
  version: process.env.CUI_VERSION,
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

const defaultCameraSettingsEntry = {
  name: '',
  room: 'Standard',
  resolution: '1280x720',
  pingTimeout: 1,
  streamTimeout: 60,
  audio: false,
  telegramType: 'Snapshot',
  alexa: false,
  webhookUrl: '',
  mqttTopic: 'camera.ui/motion',
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
  videoanalysis: {
    forceCloseTimer: 3,
    dwellTimer: 60,
    sensitivity: 75,
    difference: 5,
    regions: [
      {
        finished: true,
        coords: [
          [0, 100],
          [0, 0],
          [100, 0],
          [100, 100],
        ],
      },
    ],
  },
};

export default class Database {
  static interfaceDB;
  static notificationsDB;
  static recordingsDB;
  static tokensDB;

  static databasePath = ConfigService.databasePath;
  static databaseUserPath = ConfigService.databaseUserPath;
  static recordingsPath = ConfigService.recordingsPath;
  static reportsPath = ConfigService.reportsPath;
  static databaseFilePath = ConfigService.databaseFilePath;

  static controller;

  static atHomeAutomation = null;

  constructor(controller) {
    Database.controller = controller;
  }

  async prepareDatabase() {
    await fs.ensureDir(Database.recordingsPath);
    await fs.ensureDir(Database.databaseUserPath);
    await fs.ensureDir(Database.reportsPath);

    Database.interfaceDB = new Low(new JSONFile(Database.databaseFilePath));
    Database.tokensDB = new Low(new MemorySync());
    Database.recordingsDB = new Low(new MemorySync());
    Database.notificationsDB = new Low(new MemorySync()); //used for system events (errors)

    await Database.interfaceDB.read();
    Database.recordingsDB.read();
    Database.tokensDB.read();
    Database.notificationsDB.read();

    Database.interfaceDB.data = Database.interfaceDB.data || defaultDatabase;
    Database.tokensDB.data = Database.tokensDB.data || defaultTokensDatabase;
    Database.recordingsDB.data = Database.recordingsDB.data || defaultRecordingsDatabase;
    Database.notificationsDB.data = Database.notificationsDB.data || defaultNotificationsDatabase;

    Database.interfaceDB.chain = lodash.chain(Database.interfaceDB.data);
    Database.tokensDB.chain = lodash.chain(Database.tokensDB.data);
    Database.recordingsDB.chain = lodash.chain(Database.recordingsDB.data);
    Database.notificationsDB.chain = lodash.chain(Database.notificationsDB.data);

    await Database.#ensureDatabaseValues();
    await Database.#initializeUser();
    await Database.writeConfigCamerasToDB();
    await Database.refreshRecordingsDatabase();

    await Database.interfaceDB.chain.set('version', process.env.CUI_VERSION).value();
    await Database.startAtHomeAutomation();
    await Cleartimer.start(Database.interfaceDB, Database.recordingsDB);

    await Database.interfaceDB.write();

    LoggerService.notificationsDB = Database.notificationsDB;

    Socket.watchSystem();

    return {
      interface: Database.interfaceDB,
      tokens: Database.tokensDB,
      recordings: Database.recordingsDB,
      notifications: Database.notificationsDB,
    };
  }

  static async startAtHomeAutomation() {
    const generalSettings = await Database.interfaceDB.chain.get('settings').get('general').cloneDeep().value();

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
        await Database.interfaceDB.chain
          .get('settings')
          .get('general')
          .set('atHome', inTime ? newAtHomeValue : oldAtHomeValue)
          .value();

        await Database.interfaceDB.chain
          .get('settings')
          .get('general')
          .set('exclude', inTime ? newExcludeValue : oldExcludeValue)
          .value();
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

  static async refreshRecordingsDatabase() {
    Database.recordingsPath =
      (await Database.interfaceDB.chain.get('settings').get('recordings').get('path').cloneDeep().value()) ||
      Database.recordingsPath;

    const cameras = await Database.interfaceDB.chain.get('settings').get('cameras').cloneDeep().value();

    await fs.ensureDir(Database.recordingsPath);

    const recordingsDirectory = (await fs.readdir(Database.recordingsPath)) || [];

    const recordings = recordingsDirectory
      .filter((rec) => rec && rec.includes('_CUI') && rec.endsWith('.jpeg'))
      .map((rec) => {
        let filePath = `${Database.recordingsPath}/${rec}`;
        let isPlaceholder = rec.endsWith('@2.jpeg');
        let fileName = isPlaceholder ? rec.split('@2')[0] : rec.split('.')[0];
        let extension = isPlaceholder ? 'mp4' : 'jpeg';
        let id = rec.match(/(?<=-)([\dA-z]{10})(?=-)/)[0];
        let timestamp = rec.match(/(?<=-)(\d{10})(?=_)/)[0];
        let cameraName = rec.match(/(.*?)(?=-[\dA-z]{10})/)[0]?.replace(/_/g, ' ');
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

    Database.recordingsDB.chain.assign({ path: Database.recordingsPath, recordings: recordings }).value();
  }

  static async resetDatabase() {
    Database.interfaceDB.data = defaultDatabase;
    Database.interfaceDB.chain = lodash.chain(Database.interfaceDB.data);

    await Database.interfaceDB.write();
  }

  static async #ensureDatabaseValues() {
    let database = await Database.interfaceDB.chain.cloneDeep().value();

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

    if (typeof database?.settings.camview !== 'object') {
      database.settings.camview = defaultDatabase.settings.camview;
    }

    if (typeof database?.settings.dashboard !== 'object') {
      database.settings.dashboard = defaultDatabase.settings.dashboard;
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

    await Database.interfaceDB.chain.assign(database).value();
  }

  static #ensureCameraDatabaseValues(settings) {
    if (!settings.name) {
      settings.name = defaultCameraSettingsEntry.name;
    }

    if (!settings.room) {
      settings.room = defaultCameraSettingsEntry.room;
    }

    if (!settings.resolution) {
      settings.resolution = defaultCameraSettingsEntry.resolution;
    }

    if (!settings.pingTimeout >= 1) {
      settings.pingTimeout = defaultCameraSettingsEntry.pingTimeout;
    }

    if (!settings.streamTimeout >= 1) {
      settings.streamTimeout = defaultCameraSettingsEntry.streamTimeout;
    }

    if (typeof settings.audio !== 'boolean') {
      settings.audio = defaultCameraSettingsEntry.audio;
    }

    if (!settings.telegramType) {
      settings.telegramType = defaultCameraSettingsEntry.telegramType;
    }

    if (typeof settings.alexa !== 'boolean') {
      settings.alexa = defaultCameraSettingsEntry.alexa;
    }

    if (!settings.webhookUrl) {
      settings.webhookUrl = defaultCameraSettingsEntry.webhookUrl;
    }

    if (!settings.mqttTopic) {
      settings.mqttTopic = defaultCameraSettingsEntry.mqttTopic;
    }

    if (typeof settings.privacyMode !== 'boolean') {
      settings.privacyMode = defaultCameraSettingsEntry.privacyMode;
    }

    if (typeof settings.camview !== 'object') {
      settings.camview = {};
    }

    if (typeof settings.camview.favourite !== 'boolean') {
      settings.camview.favourite = defaultCameraSettingsEntry.camview.favourite;
    }

    if (typeof settings.camview.live !== 'boolean') {
      settings.camview.live = defaultCameraSettingsEntry.camview.live;
    }

    if (!(settings.camview.snapshotTimer >= 1)) {
      settings.camview.snapshotTimer = defaultCameraSettingsEntry.camview.snapshotTimer;
    }

    if (typeof settings.dashboard !== 'object') {
      settings.dashboard = {};
    }

    if (typeof settings.dashboard.live !== 'boolean') {
      settings.dashboard.live = defaultCameraSettingsEntry.dashboard.live;
    }

    if (!(settings.dashboard.snapshotTimer >= 1)) {
      settings.dashboard.snapshotTimer = defaultCameraSettingsEntry.dashboard.snapshotTimer;
    }

    if (typeof settings.rekognition !== 'object') {
      settings.rekognition = {};
    }

    if (typeof settings.rekognition.active !== 'boolean') {
      settings.rekognition.active = defaultCameraSettingsEntry.rekognition.active;
    }

    if (!(settings.rekognition.confidence >= 0 && settings.rekognition.confidence <= 100)) {
      settings.rekognition.confidence = defaultCameraSettingsEntry.rekognition.confidence;
    }

    if (!Array.isArray(settings.rekognition.labels)) {
      settings.rekognition.labels = defaultCameraSettingsEntry.rekognition.labels;
    }

    if (typeof settings.videoanalysis !== 'object') {
      settings.videoanalysis = {};
    }

    if (!(settings.videoanalysis.forceCloseTimer >= 0 && settings.videoanalysis.forceCloseTimer <= 10)) {
      settings.videoanalysis.forceCloseTimer = defaultCameraSettingsEntry.videoanalysis.forceCloseTimer;
    }

    if (!(settings.videoanalysis.dwellTimer >= 15)) {
      settings.videoanalysis.dwellTimer = defaultCameraSettingsEntry.videoanalysis.dwellTimer;
    }

    if (!(settings.videoanalysis.difference >= 0 && settings.videoanalysis.difference <= 255)) {
      settings.videoanalysis.difference = defaultCameraSettingsEntry.videoanalysis.difference;
    }

    if (!(settings.videoanalysis.sensitivity >= 0 && settings.videoanalysis.sensitivity <= 100)) {
      settings.videoanalysis.sensitivity = defaultCameraSettingsEntry.videoanalysis.sensitivity;
    }

    if (!Array.isArray(settings.videoanalysis.regions) || !settings.videoanalysis.regions?.length) {
      settings.videoanalysis.regions = defaultCameraSettingsEntry.videoanalysis.regions;
    }

    return settings;
  }

  static async #initializeUser() {
    const userEntries = await Database.interfaceDB.chain.get('users').cloneDeep().value();

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

      await Database.interfaceDB.chain.get('users').push(admin).value();
    }
  }

  static async addCameraToDB(camera) {
    const cameraSettingsEntry = { ...defaultCameraSettingsEntry };
    cameraSettingsEntry.name = camera.name;

    await Database.interfaceDB.chain.get('cameras').push(camera).value();
    await Database.interfaceDB.chain.get('settings').get('cameras').push(cameraSettingsEntry).value();

    return camera;
  }

  static async writeConfigCamerasToDB() {
    await Database.interfaceDB.chain
      .get('cameras')
      .remove((x) => ConfigService.ui.cameras.filter((y) => y && y.name === x.name).length === 0)
      .value();

    await Database.interfaceDB.chain
      .get('settings')
      .get('cameras')
      .remove((x) => ConfigService.ui.cameras.filter((y) => y && y.name === x.name).length === 0)
      .value();

    await Database.interfaceDB.chain
      .get('settings')
      .get('widgets')
      .get('items')
      .remove(
        (x) => x.type === 'CamerasWidget' && ConfigService.ui.cameras.filter((y) => y && y.name === x.id).length === 0
      )
      .value();

    for (const cam of ConfigService.ui.cameras) {
      const cameraExists = await Database.interfaceDB.chain.get('cameras').find({ name: cam.name }).cloneDeep().value();
      const cameraSettingsExists = await Database.interfaceDB.chain
        .get('settings')
        .get('cameras')
        .find({ name: cam.name })
        .cloneDeep()
        .value();

      await (cameraExists
        ? Database.interfaceDB.chain.get('cameras').find({ name: cam.name }).assign(cam).value()
        : Database.interfaceDB.chain.get('cameras').push(cam).value());

      if (!cameraSettingsExists) {
        const cameraSettingsEntry = { ...defaultCameraSettingsEntry };
        cameraSettingsEntry.name = cam.name;

        await Database.interfaceDB.chain.get('settings').get('cameras').push(cameraSettingsEntry).value();
      } else {
        let camSetting = this.#ensureCameraDatabaseValues(cameraSettingsExists);

        await Database.interfaceDB.chain
          .get('settings')
          .get('cameras')
          .find({ name: cam.name })
          .assign(camSetting)
          .value();
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
