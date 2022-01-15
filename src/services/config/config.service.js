'use-strict';

const crypto = require('crypto');
const ffmpegPath = require('ffmpeg-for-homebridge');
const fs = require('fs-extra');
const path = require('path');

const { LoggerService } = require('../../services/logger/logger.service');
const { version } = require('../../../package.json');

const { log } = LoggerService;

const uiDefaults = {
  port: 8081,
};

const httpDefaults = {
  port: 7272,
  localhttp: false,
};

const smtpDefaults = {
  port: 2727,
  speace_replace: '+',
};

const ftpDefaults = {
  port: 5050,
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

const defaultVideoProcess = ffmpegPath || 'ffmpeg';
const minNodeVersion = '16.12.0';

class ConfigService {
  static #secretPath = path.resolve(process.env.CUI_STORAGE_PATH, '.camera.ui.secrets');

  static name = 'camera.ui';
  static configJson = {};

  static restarted = false;

  //camera.ui env
  static storagePath = process.env.CUI_STORAGE_PATH;
  static configPath = process.env.CUI_STORAGE_CONFIG_FILE;
  static databasePath = process.env.CUI_STORAGE_DATABASE_PATH;
  static databaseUserPath = process.env.CUI_STORAGE_DATABASE_USER_PATH;
  static databaseFilePath = process.env.CUI_STORAGE_DATABASE_FILE;
  static logPath = process.env.CUI_STORAGE_LOG_PATH;
  static logFile = process.env.CUI_STORAGE_LOG_FILE;
  static recordingsPath = process.env.CUI_STORAGE_RECORDINGS_PATH;

  static debugEnabled = process.env.CUI_LOG_DEBUG === '1';
  static version = version;

  //server env
  static minimumNodeVersion = minNodeVersion;
  static serviceMode = process.env.CUI_SERVICE_MODE === '2';

  static env = {
    moduleName: process.env.CUI_MODULE_NAME,
    global: process.env.CUI_MODULE_GLOBAL === '1',
    sudo: process.env.CUI_MODULE_SUDO === '1',
  };

  //defaults
  static ui = {
    port: uiDefaults.port,
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
    version: process.env.CUI_MODULE_VERSION,
  };

  static interface = {
    permissionLevels: permissionLevels,
    jwt_secret: null,
  };

  static config = new ConfigService();

  constructor() {
    const uiConfig = fs.readJSONSync(ConfigService.configPath, { throws: false }) || {};
    ConfigService.configJson = JSON.parse(JSON.stringify(uiConfig));

    ConfigService.parseConfig(uiConfig);

    return ConfigService.ui;
  }

  static parseConfig(uiConfig) {
    ConfigService.#config(uiConfig);
    ConfigService.#configInterface();

    if (Array.isArray(uiConfig.cameras)) {
      ConfigService.#configCameras(uiConfig.cameras);
    }

    if (uiConfig.options) {
      ConfigService.#configOptions(uiConfig.options);
    }

    if (uiConfig.ssl) {
      ConfigService.#configSSL(uiConfig.ssl);
    }

    if (uiConfig.http) {
      ConfigService.#configHTTP(uiConfig.http);
    }

    if (uiConfig.smtp) {
      ConfigService.#configSMTP(uiConfig.smtp);
    }

    if (uiConfig.ftp) {
      ConfigService.#configFTP(uiConfig.ftp);
    }

    if (uiConfig.mqtt) {
      ConfigService.#configMQTT(uiConfig.mqtt);
    }
  }

  static writeToConfig(target, config) {
    if (config) {
      if (ConfigService.configJson[target]) {
        ConfigService.configJson[target] = config;
        fs.writeJSONSync(ConfigService.configPath, ConfigService.configJson, { spaces: 2 });
      } else if (!target) {
        ConfigService.configJson = config;
        fs.writeJSONSync(ConfigService.configPath, ConfigService.configJson, { spaces: 2 });
      } else {
        throw new Error(`Can not save config, target ${target} not found in config!`, 'Config', 'system');
      }
    } else {
      throw new Error('Can not save config, no config defined!', 'Config', 'system');
    }

    const uiConfig = JSON.parse(JSON.stringify(ConfigService.configJson));
    ConfigService.parseConfig(uiConfig);
  }

  static #config(uiConfig) {
    if (Number.parseInt(uiConfig.port)) {
      ConfigService.ui.port = uiConfig.port;
    }
  }

  static #configInterface() {
    const generateJWT = () => {
      const secrets = {
        jwt_secret: crypto.randomBytes(32).toString('hex'),
      };

      ConfigService.interface.jwt_secret = secrets.jwt_secret;

      fs.ensureFileSync(ConfigService.#secretPath);
      fs.writeJsonSync(ConfigService.#secretPath, secrets, { spaces: 2 });
    };

    if (fs.pathExistsSync(ConfigService.#secretPath)) {
      try {
        const secrets = fs.readJsonSync(ConfigService.#secretPath);

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

  static #configSSL(ssl = {}) {
    if (ssl.key && ssl.cert) {
      try {
        ConfigService.ui.ssl = {
          key: fs.readFileSync(ssl.key, 'utf8'),
          cert: fs.readFileSync(ssl.cert, 'utf8'),
        };
      } catch (error) {
        log.warn(`WARNING: Could not read SSL Cert/Key. Error: ${error.message}`, 'Config', 'system');
      }
    }
  }

  static #configOptions(options = {}) {
    if (options.videoProcessor) {
      ConfigService.ui.options.videoProcessor = options.videoProcessor;
    }
  }

  static #configHTTP(http = {}) {
    if (!http.active) {
      return;
    }

    ConfigService.ui.http = {
      port: http.port || httpDefaults.port,
      localhttp: http.localhttp || httpDefaults.localhttp,
    };
  }

  static #configSMTP(smtp = {}) {
    if (!smtp.active) {
      return;
    }

    ConfigService.ui.smtp = {
      port: smtp.port || smtpDefaults.port,
      space_replace: smtp.space_replace || smtpDefaults.speace_replace,
    };
  }

  static #configFTP(ftp = {}) {
    if (!ftp.active) {
      return;
    }

    ConfigService.ui.ftp = {
      port: ftp.port || ftpDefaults.port,
    };
  }

  static #configMQTT(mqtt = {}) {
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

  static #configCameras(cameras = []) {
    ConfigService.ui.topics.clear();

    ConfigService.ui.cameras = cameras
      // include only cameras with given name, videoConfig and source
      .filter((camera) => camera.name && camera.videoConfig?.source)
      .map((camera) => {
        const sourceArguments = camera.videoConfig.source.split(/\s+/);

        if (!sourceArguments.includes('-i')) {
          log.warn(
            `${camera.name}: The source for this camera is missing "-i", it is likely misconfigured.`,
            'Config',
            'system'
          );
          camera.videoConfig.source = false;
        }

        if (camera.videoConfig.subSource) {
          const stillArguments = camera.videoConfig.subSource.split(/\s+/);

          if (!stillArguments.includes('-i')) {
            log.warn(`${camera.name}: The subSource for this camera is missing "-i" !`, 'Config', 'system');
            camera.videoConfig.subSource = camera.videoConfig.source;
          }
        } else {
          camera.videoConfig.subSource = camera.videoConfig.source;
        }

        if (camera.videoConfig.stillImageSource) {
          const stillArguments = camera.videoConfig.stillImageSource.split(/\s+/);

          if (!stillArguments.includes('-i')) {
            log.warn(`${camera.name}: The stillImageSource for this camera is missing "-i" !`, 'Config', 'system');
            camera.videoConfig.stillImageSource = camera.videoConfig.source;
          }
        } else {
          camera.videoConfig.stillImageSource = camera.videoConfig.source;
        }

        camera.motionTimeout =
          camera.motionTimeout === undefined || !(camera.motionTimeout >= 0) ? 15 : camera.motionTimeout;

        // validate prebufferLength
        camera.prebufferLength =
          (camera.prebufferLength >= 4 && camera.prebufferLength <= 8 ? camera.prebufferLength : 4) * 1000;

        // setup video analysis
        camera.videoanalysis = {
          active: camera.videoanalysis?.active || false,
        };

        // setup mqtt
        camera.mqtt = camera.mqtt || {};

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

        return camera;
      })
      // exclude cameras with invalid videoConfig, source
      .filter((camera) => camera.videoConfig?.source);
  }
}

exports.ConfigService = ConfigService;
