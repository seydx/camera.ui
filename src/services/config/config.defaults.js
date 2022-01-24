/* eslint-disable unicorn/prefer-number-properties */
'use-strict';

import ffmpegPath from 'ffmpeg-for-homebridge';

export const uiDefaults = {
  port: 8081,
};

export const httpDefaults = {
  port: 7272,
  localhttp: false,
};

export const smtpDefaults = {
  port: 2727,
  speace_replace: '+',
};

export const ftpDefaults = {
  port: 5050,
  useFile: false,
};

export const mqttDefault = {
  tls: false,
  port: 1883,
};

export const permissionLevels = [
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

export const defaultVideoProcess = ffmpegPath || 'ffmpeg';

export const minNodeVersion = '16.12.0';

export class ConfigSetup {
  constructor(config = {}) {
    return {
      ...ConfigSetup.setupUi(config),
      options: ConfigSetup.setupOptions(config?.options),
      ssl: ConfigSetup.setupSsl(config?.ssl),
      http: ConfigSetup.setupHttp(config?.http),
      smtp: ConfigSetup.setupSmtp(config?.smtp),
      ftp: ConfigSetup.setupFtp(config?.ftp),
      mqtt: ConfigSetup.setupMqtt(config?.mqtt),
      cameras: ConfigSetup.setupCameras(config?.cameras),
    };
  }

  static setupUi(config = {}) {
    return {
      debug: config?.debug || false,
      port: config?.port || uiDefaults.port,
      atHomeSwitch: config?.atHomeSwitch || false,
    };
  }

  static setupOptions(options = {}) {
    return {
      videoProcessor: options?.videoProcessor || defaultVideoProcess,
    };
  }

  static setupSsl(ssl = {}) {
    return {
      active: Boolean(ssl?.active && ssl?.key && ssl?.cert),
      key: ssl?.key,
      cert: ssl?.cert,
    };
  }

  static setupMqtt(mqtt = {}) {
    return {
      active: Boolean(mqtt?.active && mqtt?.host),
      tls: mqtt?.tls || mqttDefault.tls,
      host: mqtt?.host,
      port: !isNaN(mqtt?.port) ? mqtt.port : mqttDefault.port,
      username: mqtt?.username,
      password: mqtt?.password,
    };
  }

  static setupHttp(http = {}) {
    return {
      active: http?.active || false,
      port: !isNaN(http?.port) ? http.port : httpDefaults.port,
      localhttp: http?.localhttp || httpDefaults.localhttp,
    };
  }

  static setupSmtp(smtp = {}) {
    return {
      active: smtp?.active || false,
      port: !isNaN(smtp?.port) ? smtp.port : smtpDefaults.port,
      space_replace: smtp?.space_replace || smtpDefaults.speace_replace,
    };
  }

  static setupFtp(ftp = {}) {
    return {
      active: ftp?.active || false,
      useFile: ftp?.useFile || ftpDefaults.useFile,
      port: !isNaN(ftp?.port) ? ftp.port : ftpDefaults.port,
    };
  }

  static setupCameras(cameras = []) {
    return cameras || [];
  }
}
