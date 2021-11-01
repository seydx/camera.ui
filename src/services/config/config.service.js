'use-strict';

const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

const { LoggerService } = require('../../services/logger/logger.service');
const { version } = require('../../../package.json');

const { log } = LoggerService;

const uiDefaults = {
  port: 8081,
  theme: 'auto',
  language: 'auto',
};

const httpDefaults = {
  port: 7272,
  localhttp: false,
};

const smtpDefaults = {
  port: 2727,
  speace_replace: '+',
};

const mqttDefault = {
  tls: false,
  port: 1883,
  username: '',
  password: '',
};

const permissionLevels = [
  'admin',
  //API
  'backup:download',
  'backup:restore',
  'cameras:access',
  'cameras:edit',
  'config:access',
  'config:edit',
  'notifications:access',
  'notifications:edit',
  'recordings:access',
  'recordings:edit',
  'settings:access',
  'settings:edit',
  'users:access',
  'users:edit',
  //CLIENT
  'camview:access',
  'dashboard:access',
  'settings:cameras:access',
  'settings:cameras:edit',
  'settings:camview:access',
  'settings:camview:edit',
  'settings:config:access',
  'settings:config:edit',
  'settings:dashboard:access',
  'settings:dashboard:edit',
  'settings:general:access',
  'settings:general:edit',
  'settings:notifications:access',
  'settings:notifications:edit',
  'settings:profile:access',
  'settings:profile:edit',
  'settings:recordings:access',
  'settings:recordings:edit',
];

const defaultVideoProcess = 'ffmpeg';
const minNodeVersion = '16.12.0';

class ConfigService {
  #secretPath = path.resolve(process.env.CUI_STORAGE_PATH, '.camera.ui.secrets');

  static name = 'camera.ui';

  //camera.ui env
  static storagePath = process.env.CUI_STORAGE_PATH;
  static configPath = process.env.CUI_STORAGE_CONFIG_FILE;
  static databasePath = process.env.CUI_STORAGE_DATABASE_PATH;
  static databaseUserPath = process.env.CUI_STORAGE_DATABASE_USER_PATH;
  static databaseFilePath = process.env.CUI_STORAGE_DATABASE_FILE;
  static recordingsPath = process.env.CUI_STORAGE_RECORDINGS_PATH;

  static debugEnabled = process.env.CUI_LOG_DEBUG === '1';
  static version = version;

  //server env
  static minimumNodeVersion = minNodeVersion;
  static serviceMode = process.env.CUI_SERVICE_MODE === '2';

  //defaults
  static ui = {
    port: uiDefaults.port,
    theme: uiDefaults.theme,
    language: uiDefaults.language,
    debug: true,
    ssl: false,
    mqtt: false,
    topics: new Map(),
    http: false,
    smtp: false,
    options: {
      videoProcessor: defaultVideoProcess,
    },
    cameras: [],
    version: version,
  };

  static interface = {
    permissionLevels: permissionLevels,
    jwt_secret: null,
  };

  static config = new ConfigService();

  constructor() {
    const uiConfig = fs.readJSONSync(ConfigService.configPath, { throws: false }) || {};
    this.parseConfig(uiConfig);

    return ConfigService.ui;
  }

  parseConfig(uiConfig) {
    this.#config(uiConfig);
    this.#configInterface();

    if (Array.isArray(uiConfig.cameras)) {
      this.#configCameras(uiConfig.cameras);
    }

    if (uiConfig.options) {
      this.#configOptions(uiConfig.options);
    }

    if (uiConfig.ssl) {
      this.#configSSL(uiConfig.ssl);
    }

    if (uiConfig.http) {
      this.#configHTTP(uiConfig.http);
    }

    if (uiConfig.smtp) {
      this.#configSMTP(uiConfig.smtp);
    }

    if (uiConfig.mqtt) {
      this.#configMQTT(uiConfig.mqtt);
    }
  }

  static writeToConfig(target, config) {
    if (ConfigService.ui[target] && config) {
      fs.writeJSONSync(ConfigService.configPath, config, { spaces: 2 });
    }
  }

  #config(uiConfig) {
    const validThemes = [
      'auto',
      'light-pink',
      'light-blue',
      'light-yellow',
      'light-green',
      'light-orange',
      'light-brown',
      'light-gray',
      'light-blgray',
      'light-purple',
      'dark-pink',
      'dark-blue',
      'dark-yellow',
      'dark-green',
      'dark-orange',
      'dark-brown',
      'dark-gray',
      'dark-blgray',
      'dark-purple',
    ];

    const validLanguage = ['auto', 'de', 'en', 'nl'];

    if (Number.parseInt(uiConfig.port)) {
      ConfigService.ui.port = uiConfig.port;
    }

    if (validThemes.includes(uiConfig.theme)) {
      ConfigService.ui.theme = uiConfig.theme;
    }

    if (validLanguage.includes(uiConfig.language)) {
      ConfigService.ui.language = uiConfig.language;
    }
  }

  #configInterface() {
    const generateJWT = () => {
      const secrets = {
        jwt_secret: crypto.randomBytes(32).toString('hex'),
      };

      ConfigService.interface.jwt_secret = secrets.jwt_secret;

      fs.ensureFileSync(this.#secretPath);
      fs.writeJsonSync(this.#secretPath, secrets, { spaces: 2 });
    };

    if (fs.pathExistsSync(this.#secretPath)) {
      try {
        const secrets = fs.readJsonSync(this.#secretPath);

        if (!secrets.jwt_secret) {
          generateJWT();
        } else {
          ConfigService.interface.jwt_secret = secrets.jwt_secret;
        }
      } catch {
        generateJWT();
      }
    } else {
      generateJWT();
    }
  }

  #configSSL(ssl = {}) {
    if (ssl.key && ssl.cert) {
      try {
        ConfigService.ui.ssl = {
          key: ssl.key,
          keyBuffer: fs.readFileSync(ssl.key, 'utf8'),
          cert: ssl.cert,
          certBuffer: fs.readFileSync(ssl.cert, 'utf8'),
        };
      } catch (error) {
        log.warn(`WARNING: Could not read SSL Cert/Key. Error: ${error.message}`);
      }
    }
  }

  #configOptions(options = {}) {
    if (options.videoProcessor) {
      ConfigService.ui.options.videoProcessor = options.videoProcessor;
    }
  }

  #configHTTP(http = {}) {
    if (!http.active) {
      return;
    }

    ConfigService.ui.http = {
      port: http.port || httpDefaults.port,
      localhttp: http.localhttp || httpDefaults.localhttp,
    };
  }

  #configSMTP(smtp = {}) {
    if (!smtp.active) {
      return;
    }

    ConfigService.ui.smtp = {
      port: smtp.port || smtpDefaults.port,
      httpPort: ConfigService.ui.http?.port || httpDefaults.port,
      space_replace: smtp.space_replace || smtpDefaults.speace_replace,
    };
  }

  #configMQTT(mqtt = {}) {
    if (!mqtt.active || !mqtt.host) {
      return;
    }

    ConfigService.ui.mqtt = {
      tls: mqtt.tls || mqttDefault.tls,
      host: mqtt.host,
      port: mqtt.port || mqttDefault.port,
      username: mqtt.username || mqttDefault.username,
      password: mqtt.password || mqttDefault.password,
    };
  }

  #configCameras(cameras = []) {
    ConfigService.ui.cameras = cameras
      // include only cameras with given name, videoConfig and source
      .filter((camera) => camera.name && camera.videoConfig?.source)
      .map((camera) => {
        const sourceArguments = camera.videoConfig.source.split(/\s+/);

        if (!sourceArguments.includes('-i')) {
          log.warn(`${camera.name}: The source for this camera is missing "-i", it is likely misconfigured.`);
          camera.videoConfig.source = false;
        }

        if (camera.videoConfig.stimeout > 0 && !sourceArguments.includes('-stimeout')) {
          if (sourceArguments.includes('-re')) {
            camera.videoConfig.source = camera.videoConfig.source.replace(
              '-re',
              `-stimeout ${camera.videoConfig.stimeout * 10000000} -re` //-stimeout is in micro seconds
            );
          } else if (sourceArguments.includes('-i')) {
            camera.videoConfig.source = camera.videoConfig.source.replace(
              '-i',
              `-stimeout ${camera.videoConfig.stimeout * 10000000} -i` //-stimeout is in micro seconds
            );
          }
        }

        if (camera.videoConfig.stillImageSource) {
          const stillArguments = camera.videoConfig.stillImageSource.split(/\s+/);

          if (!stillArguments.includes('-i')) {
            log.warn(`${camera.name}: The stillImageSource for this camera is missing "-i" !`);
            camera.videoConfig.stillImageSource = camera.videoConfig.source || false;
          }
        } else {
          camera.videoConfig.stillImageSource = camera.videoConfig.source;
        }

        //validate some required parameter
        camera.videoConfig.maxWidth = camera.videoConfig.maxWidth || 1280;
        camera.videoConfig.maxHeight = camera.videoConfig.maxHeight || 720;
        camera.videoConfig.maxFPS = camera.videoConfig.maxFPS >= 20 ? camera.videoConfig.maxFPS : 20;
        camera.videoConfig.maxStreams = camera.videoConfig.maxStreams >= 1 ? camera.videoConfig.maxStreams : 3;
        camera.videoConfig.maxBitrate = camera.videoConfig.maxBitrate || '299k';
        camera.videoConfig.vcodec = camera.videoConfig.vcodec || 'libx264';
        camera.videoConfig.mapvideo = camera.videoConfig.mapvideo || false;
        camera.videoConfig.mapaudio = camera.videoConfig.mapaudio || false;
        camera.videoConfig.videoFilter = camera.videoConfig.videoFilter || false;
        camera.videoConfig.encoderOptions = camera.videoConfig.encoderOptions || 'ultrafast -tune zerolatency';

        return camera;
      })
      // exclude cameras with invalid videoConfig, source
      .filter((camera) => camera.videoConfig?.source)
      // setup mqtt topics
      .map((camera) => {
        if (camera.mqtt) {
          //setup mqtt topics
          if (camera.mqtt.motionTopic) {
            const mqttOptions = {
              motionTopic: camera.mqtt.motionTopic,
              motionMessage: camera.mqtt.motionMessage || 'ON',
              motionResetMessage: camera.mqtt.motionResetMessage || 'OFF',
              camera: camera.name,
              motion: true,
            };

            ConfigService.ui.topics.set(mqttOptions.motionTopic, mqttOptions);
          }

          if (camera.mqtt.motionResetTopic && camera.mqtt.motionResetTopic !== camera.mqtt.motionTopic) {
            const mqttOptions = {
              motionResetTopic: camera.mqtt.motionResetTopic,
              motionResetMessage: camera.mqtt.motionResetMessage || 'OFF',
              camera: camera.name,
              motion: true,
              reset: true,
            };

            ConfigService.ui.topics.set(mqttOptions.motionResetTopic, mqttOptions);
          }

          if (
            camera.mqtt.doorbellTopic &&
            camera.mqtt.doorbellTopic !== camera.mqtt.motionTopic &&
            camera.mqtt.doorbellTopic !== camera.mqtt.motionResetTopic
          ) {
            const mqttOptions = {
              doorbellTopic: camera.mqtt.doorbellTopic,
              doorbellMessage: camera.mqtt.doorbellMessage || 'ON',
              camera: camera.name,
              doorbell: true,
            };

            ConfigService.ui.topics.set(mqttOptions.doorbellTopic, mqttOptions);
          }
        }

        return camera;
      });
  }
}

exports.ConfigService = ConfigService;
