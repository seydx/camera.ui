'use-strict';

import Bunyan from 'bunyan';
import escapeRegExp from 'lodash/escapeRegExp.js';
import has from 'lodash/has.js';
import get from 'lodash/get.js';
import { FileSystem, FtpSrv } from 'ftp-srv';
import http from 'http';
import ip from 'ip';
import { simpleParser } from 'mailparser';
import mqtt from 'mqtt';
import { parse } from 'url';
import path from 'path';
import { SMTPServer } from 'smtp-server';
import Stream from 'stream';

import ConfigService from '../../services/config/config.service.js';
import LoggerService from '../../services/logger/logger.service.js';

import Database from '../../api/database.js';
import Socket from '../../api/socket.js';

const { log } = LoggerService;
const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toDotNot = (input, parentKey) =>
  // eslint-disable-next-line unicorn/no-array-reduce, unicorn/prefer-object-from-entries
  Object.keys(input || {}).reduce((accumulator, key) => {
    const value = input[key];
    const outputKey = parentKey ? `${parentKey}.${key}` : `${key}`;

    // NOTE: remove `&& (!Array.isArray(value) || value.length)` to exclude empty arrays from the output
    if (value && typeof value === 'object' && (!Array.isArray(value) || value.length > 0)) {
      return { ...accumulator, ...toDotNot(value, outputKey) };
    }

    return { ...accumulator, [outputKey]: value };
  }, {});

export default class MotionController {
  static #controller;
  static #motionTimers = new Map();

  static httpServer = null;
  static mqttClient = null;
  static smtpServer = null;
  static ftpServer = null;

  constructor(controller) {
    MotionController.#controller = controller;

    if (ConfigService.ui.http) {
      MotionController.startHttpServer();
    }

    if (ConfigService.ui.mqtt) {
      MotionController.startMqttClient();
    }

    if (ConfigService.ui.smtp) {
      MotionController.startSmtpServer();
    }

    if (ConfigService.ui.ftp) {
      MotionController.startFtpServer();
    }

    //used for external events
    this.triggerMotion = MotionController.triggerMotion = async (cameraName, state) => {
      await MotionController.handleMotion('motion', cameraName, state, 'extern');
    };

    this.httpServer = MotionController.httpServer;
    this.startHttpServer = MotionController.startHttpServer;
    this.closeHttpServer = MotionController.closeHttpServer;

    this.mqttClient = MotionController.mqttClient;
    this.startMqttClient = MotionController.startMqttClient;
    this.closeMqttClient = MotionController.closeMqttClient;

    this.smtpServer = MotionController.smtpServer;
    this.startSmtpServer = MotionController.startSmtpServer;
    this.closeSmtpServer = MotionController.closeSmtpServer;

    this.ftpServer = MotionController.ftpServer;
    this.startFtpServer = MotionController.startFtpServer;
    this.closeFtpServer = MotionController.closeFtpServer;

    this.close = MotionController.close;
  }

  /**
   *
   * @url https://github.com/Sunoo/homebridge-camera-ffmpeg/blob/master/src/index.ts
   * (c) Sunoo <https://github.com/sunoo>
   *
   **/
  static startHttpServer() {
    log.debug('Setting up HTTP server for motion detection...');

    const hostname = ConfigService.ui.http.localhttp ? 'localhost' : undefined;

    MotionController.httpServer = http.createServer();

    MotionController.httpServer.on('listening', async () => {
      let addr = MotionController.httpServer.address();
      let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

      log.debug(`HTTP server for motion detection is listening on ${bind}`);

      Socket.io.emit('httpStatus', {
        status: 'online',
      });
    });

    MotionController.httpServer.on('error', (error) => {
      let error_;

      if (error.syscall !== 'listen') {
        log.error(error, 'HTTP Server', 'motion');
      }

      let bind = typeof port === 'string' ? 'Pipe ' + ConfigService.ui.http.port : 'Port ' + ConfigService.ui.http.port;

      switch (error.code) {
        case 'EACCES':
          error_ = `Can not start the HTTP server for motion detection! ${bind} requires elevated privileges`;
          break;
        case 'EADDRINUSE':
          error_ = `Can not start the HTTP server for motion detection! ${bind} is already in use`;
          break;
        default:
          error_ = error;
      }

      log.error(error_, 'HTTP Server', 'motion');

      Socket.io.emit('httpStatus', {
        status: 'offline',
      });
    });

    MotionController.httpServer.on('request', async (request, response) => {
      let result = {
        error: true,
        message: `Malformed URL ${request.url}`,
      };

      log.info(`New message: URL: ${request.url}`, 'HTTP');

      let cameraName;

      if (request.url) {
        const parseurl = parse(request.url);

        if (parseurl.pathname && parseurl.query) {
          cameraName = decodeURIComponent(parseurl.query);

          // => /motion
          // => /motion/reset
          // => /doorbell

          let triggerType = parseurl.pathname.includes('/reset') ? 'reset' : parseurl.pathname.split('/')[1];
          let state = triggerType === 'dorbell' ? true : triggerType === 'reset' ? false : true;
          triggerType = triggerType === 'reset' ? 'motion' : triggerType;

          result = await MotionController.handleMotion(triggerType, cameraName, state, 'http', result);
        }
      }

      response.writeHead(result.error ? 500 : 200);
      response.write(JSON.stringify(result));
      response.end();
    });

    MotionController.httpServer.on('close', () => {
      log.debug('HTTP Server closed');

      Socket.io.emit('httpStatus', {
        status: 'offline',
      });
    });

    MotionController.httpServer.listen(ConfigService.ui.http.port, hostname);
  }

  /**
   *
   * @url https://github.com/Sunoo/homebridge-camera-ffmpeg/blob/master/src/index.ts
   * (c) Sunoo <https://github.com/sunoo>
   *
   **/
  static startMqttClient() {
    log.debug('Setting up MQTT client for motion detection...');

    MotionController.mqttClient = mqtt.connect(
      (ConfigService.ui.mqtt.tls ? 'mqtts://' : 'mqtt://') +
        ConfigService.ui.mqtt.host +
        ':' +
        ConfigService.ui.mqtt.port,
      {
        username: ConfigService.ui.mqtt.username || '',
        password: ConfigService.ui.mqtt.password || '',
      }
    );

    MotionController.mqttClient.on('connect', () => {
      log.debug(`MQTT Client for motion detection connected to broker on port ${ConfigService.ui.mqtt.port}`);

      for (const [topic] of ConfigService.ui.topics) {
        log.debug(`Subscribing to MQTT topic: ${topic}`);
        MotionController.mqttClient.subscribe(topic + '/#');
      }

      Socket.io.emit('mqttStatus', {
        status: 'online',
      });
    });

    MotionController.mqttClient.on('message', async (topic, data) => {
      data = data.toString();

      log.info(`New message: Topic: ${topic} - Data: ${data} - Type: ${typeof data}`, 'MQTT');

      let cameraName;

      const cameraMqttConfig = ConfigService.ui.topics.get(topic);

      if (cameraMqttConfig) {
        cameraName = cameraMqttConfig.camera;

        let index = 0;
        let message;
        let state;
        let triggerType;

        if (cameraMqttConfig.reset) {
          triggerType = 'reset';
          message = cameraMqttConfig.motionResetMessage;
        } else if (cameraMqttConfig.motion) {
          triggerType = 'motion';
          message = cameraMqttConfig.motionMessage;
        } else {
          triggerType = 'doorbell';
          message = cameraMqttConfig.doorbellMessage;
        }

        const triggerState = () => {
          let value;

          switch (triggerType) {
            case 'reset': {
              value = false;
              break;
            }
            case 'motion': {
              value = true;
              break;
            }
            case 'doorbell': {
              value = true;
              break;
            }
            // No default
          }

          return value;
        };

        const check = (message_) => {
          let state_;
          let json = false;
          message_ = message_ || message;

          try {
            const dataObject = JSON.parse(data);
            const messageObject = JSON.parse(message);

            json = true;

            if (dataObject === message || dataObject.toString() === message_.toString()) {
              state_ = triggerState();
            } else if (typeof dataObject === typeof messageObject) {
              const dotNotMessage = toDotNot(messageObject);
              const dotNotMessagePath = Object.keys(dotNotMessage)[0];
              const dotNotMessageResult = Object.values(dotNotMessage)[0];
              const pathExist = has(dataObject, dotNotMessagePath);
              const sameValue = get(dataObject, dotNotMessagePath) === dotNotMessageResult;

              if (pathExist && sameValue) {
                state_ = triggerState();
              }
            }
          } catch {
            if (message_ === data) {
              state_ = triggerState();
            }
          }

          log.debug(
            {
              camera: cameraName,
              topic: topic,
              data: data,
              json: json,
              message: message_,
              state: state_,
              try: index,
            },
            'MQTT'
          );

          index++;

          return state_;
        };

        state = check();

        if (state === undefined && triggerType === 'motion') {
          const resetted = check(cameraMqttConfig.motionResetMessage);

          if (resetted !== undefined) {
            state = !resetted;
          }
        }

        if (state !== undefined) {
          triggerType = triggerType === 'reset' ? 'motion' : triggerType;
          await MotionController.handleMotion(triggerType, cameraName, state, 'mqtt');
        } else {
          log.warn(
            `The incoming MQTT message (${data}) for the topic (${topic}) was not the same as set in config.json (${message}). Skip...`
          );
        }
      } else {
        log.warn(`Can not assign the MQTT topic (${topic}) to a camera!`, 'MQTT');
      }
    });

    MotionController.mqttClient.on('end', () => {
      log.debug('MQTT client disconnected');

      Socket.io.emit('mqttStatus', {
        status: 'offline',
      });
    });
  }

  /**
   *
   * @url https://github.com/Sunoo/homebridge-smtp-motion
   * (c) Sunoo <https://github.com/sunoo>
   *
   **/
  static startSmtpServer() {
    log.debug('Setting up SMTP server for motion detection...');

    const regex = new RegExp(escapeRegExp(ConfigService.ui.smtp.space_replace), 'g');

    const bunyan = Bunyan.createLogger({
      name: 'smtp',
      streams: [
        {
          stream: new Stream.Writable({
            write: (chunk, _encoding, callback) => {
              const data = JSON.parse(chunk);

              if (data.level >= 50) {
                log.error(data.msg, 'SMTP', 'motion');
              } else if (data.level >= 40) {
                log.warn(data.msg, 'SMTP', 'motion');
              }

              callback();
            },
          }),
        },
      ],
    });

    MotionController.smtpServer = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      disableReverseLookup: true,
      logger: bunyan,
      onAuth(_auth, _session, callback) {
        callback(null, { user: true });
      },
      async onData(stream, session, callback) {
        stream.on('end', callback);

        log.debug(session, 'SMTP');

        const cameras = ConfigService.ui.cameras.map((camera) => {
          return {
            name: camera.name,
            from: camera.smtp?.from || false,
            email: camera.smtp?.email || camera.name,
            body: camera.smtp?.body || false,
          };
        });

        const mailFrom = session.envelope.mailFrom.address.split('@')[0].replace(regex, ' ');
        const mailFromCamera = cameras.find((camera) => camera.from === mailFrom);

        const mailTo = session.envelope.rcptTo[0].address.split('@')[0].replace(regex, ' ');
        const mailToCamera = cameras.find((camera) => camera.email === mailTo);

        if (mailToCamera || mailFromCamera) {
          let name;

          if (mailToCamera) {
            log.info(`New message: Data (email to): ${JSON.stringify(session.envelope.rcptTo)}`, 'SMTP');
            name = mailTo;
          } else {
            log.info(`New message: Data (email from): ${JSON.stringify(session.envelope.mailFrom)}`, 'SMTP');
            name = mailFrom;
          }

          return await MotionController.handleMotion('motion', name, true, 'smtp');
        } else {
          log.info(
            'Email received but can not determine camera name through email adresse(s), checking email body...',
            'SMTP'
          );

          const cameraHasBody = cameras.some((camera) => camera.body);

          if (cameraHasBody) {
            const parsed = await simpleParser(stream);
            const body = parsed.textAsHtml;

            for (const camera of cameras) {
              if (camera.body && body.includes(camera.body)) {
                log.info(`New message: Data (email body): "${body}"`, 'SMTP');
                return await MotionController.handleMotion('motion', camera.name, true, 'smtp');
              }
            }
          }
        }

        //not found
        await MotionController.handleMotion('motion', mailTo, true, 'smtp');
      },
    });

    MotionController.smtpServer.server.on('listening', () => {
      log.debug(`SMTP server for motion detection is listening on port ${ConfigService.ui.smtp.port}`);

      Socket.io.emit('smtpStatus', {
        status: 'online',
      });
    });

    MotionController.smtpServer.server.on('close', () => {
      log.debug('SMTP Server closed');

      Socket.io.emit('smtpStatus', {
        status: 'offline',
      });
    });

    MotionController.smtpServer.listen(ConfigService.ui.smtp.port);
  }

  /**
   *
   * @url https://github.com/Sunoo/homebridge-ftp-motion
   * (c) Sunoo <https://github.com/sunoo>
   *
   **/
  static startFtpServer() {
    log.debug('Setting up FTP server for motion detection...');

    const ipAddr = ip.address('public', 'ipv4');

    const bunyan = Bunyan.createLogger({
      name: 'ftp',
      streams: [
        {
          stream: new Stream.Writable({
            write: (chunk, _encoding, callback) => {
              const data = JSON.parse(chunk);

              if (data.level >= 50) {
                if (data.err?.message !== 'Server is not running.') {
                  log.error(data.msg, 'FTP', 'motion');
                }
              } else if (data.level >= 40) {
                log.warn(data.msg, 'FTP', 'motion');
              }

              callback();
            },
          }),
        },
      ],
    });

    MotionController.ftpServer = new FtpSrv({
      url: `ftp://${ipAddr}:${ConfigService.ui.ftp.port}`,
      pasv_url: ipAddr,
      anonymous: true,
      blacklist: ['MKD', 'APPE', 'RETR', 'DELE', 'RNFR', 'RNTO', 'RMD'],
      log: bunyan,
    });

    MotionController.ftpServer.on('login', (data, resolve) => {
      resolve({
        fs: new (class extends FileSystem {
          constructor() {
            super();
            this.connection = data.connection;
            this.realCwd = '/';
          }

          get(fileName) {
            return {
              name: fileName,
              isDirectory: () => true,
              size: 1,
              atime: new Date(),
              mtime: new Date(),
              ctime: new Date(),
              uid: 0,
              gid: 0,
            };
          }

          list(filePath = '.') {
            filePath = path.resolve(this.realCwd, filePath);

            const directories = [...this.get('.')];
            const pathSplit = filePath.split('/').filter((value) => value.length > 0);

            if (pathSplit.length === 0) {
              for (const camera of ConfigService.ui.cameras) {
                directories.push(this.get(camera.name));
              }
            } else {
              directories.push(this.get('..'));
            }

            return directories;
          }

          chdir(filePath = '.') {
            filePath = path.resolve('/', filePath);
            this.realCwd = filePath;
            return filePath;
          }

          // eslint-disable-next-line no-unused-vars
          async write(fileName, { append = false, start }) {
            let filePath = path.resolve(this.realCwd, fileName);

            let pathSplit = path.dirname(filePath).split('/').filter(Boolean);

            log.info(
              `New message: File Name: ${fileName} - File Path: ${filePath} - Path Split ${JSON.stringify(pathSplit)}`,
              'FTP'
            );

            if (pathSplit.length === 0 && ConfigService.ui.ftp.useFile) {
              const name = fileName.split(/[^A-Za-z]/g)[0];
              pathSplit.push(name);
            }

            if (pathSplit.length > 0) {
              const name = pathSplit[0];
              await MotionController.handleMotion('motion', name, true, 'ftp');
            } else {
              this.connection.reply(550, 'Permission denied.');
            }

            return new Stream.Writable({
              write: (chunk, encoding, callback) => {
                callback();
              },
            });
          }

          // eslint-disable-next-line no-unused-vars
          chmod(filePath, mode) {
            return;
          }

          // eslint-disable-next-line no-unused-vars
          mkdir(filePath) {
            this.connection.reply(550, 'Permission denied.');
            return this.realCwd;
          }

          // eslint-disable-next-line no-unused-vars
          read(fileName, { start }) {
            this.connection.reply(550, 'Permission denied.');
            return;
          }

          // eslint-disable-next-line no-unused-vars
          delete(filePath) {
            this.connection.reply(550, 'Permission denied.');
            return;
          }

          // eslint-disable-next-line no-unused-vars
          rename(from, to) {
            this.connection.reply(550, 'Permission denied.');
            return;
          }
        })(),
        cwd: '/',
      });
    });

    MotionController.ftpServer.server.on('listening', () => {
      log.debug(`FTP server for motion detection is listening on port ${ConfigService.ui.ftp.port}`);

      Socket.io.emit('ftpStatus', {
        status: 'online',
      });
    });

    MotionController.ftpServer.server.on('close', () => {
      if (!MotionController.ftpServer.server.alreadyClosed) {
        MotionController.ftpServer.server.alreadyClosed = true;

        log.debug('FTP Server closed');

        Socket.io.emit('ftpStatus', {
          status: 'offline',
        });
      }
    });

    MotionController.ftpServer.listen();
  }

  static closeHttpServer() {
    if (MotionController.httpServer) {
      MotionController.httpServer.close();
    }
  }

  static closeMqttClient() {
    if (MotionController.mqttClient) {
      MotionController.mqttClient.end();
    }
  }

  static closeSmtpServer() {
    if (MotionController.smtpServer) {
      MotionController.smtpServer.close();
    }
  }

  static closeFtpServer() {
    if (MotionController.ftpServer) {
      MotionController.ftpServer.close();
    }
  }

  static close() {
    if (MotionController.httpServer) {
      MotionController.httpServer.close();
    }

    if (MotionController.mqttClient) {
      MotionController.mqttClient.end();
    }

    if (MotionController.smtpServer) {
      MotionController.smtpServer.close();
    }

    if (MotionController.ftpServer) {
      MotionController.ftpServer.close();
    }
  }

  static async handleMotion(triggerType, cameraName, state, event, result = {}) {
    // result = {} is used as http response
    let camera = ConfigService.ui.cameras.find((camera) => camera?.name === cameraName);

    if (event === 'smtp') {
      camera = ConfigService.ui.cameras.find(
        (camera) => camera?.smtp?.email === cameraName || camera?.name === cameraName
      );
    }

    if (camera) {
      if (camera.motionDelay > 0) {
        log.info(
          `Movement delay (${camera.motionDelay}s) is active, wait before triggering the event - Trigger: ${triggerType} - State: ${state} - Event: ${event}`,
          camera.name
        );

        await timeout(camera.motionDelay * 1000);
      }

      const settingsDatabase = await Database.interfaceDB.chain.get('settings').cloneDeep().value();
      const cameraSettings = settingsDatabase?.cameras.find((cam) => cam.name === cameraName);
      const atHome = settingsDatabase?.general?.atHome || false;
      const cameraExcluded = (settingsDatabase?.general?.exclude || []).includes(camera.name);

      if (atHome && !cameraExcluded) {
        const message = `Skip motion trigger. At Home is active and ${camera.name} is not excluded!`;

        log.info(message, camera.name);

        result = {
          error: false,
          message: message,
        };
      } else {
        result = {
          error: false,
          message: `Handling through ${camera.recordOnMovement ? 'intern' : 'extern'} controller..`,
        };

        log.debug(result, camera.name);

        MotionController.#controller.emit('motion', camera.name, triggerType, state, event); // used for extern controller, like Homebridge

        if (camera.recordOnMovement) {
          const mqttClient = MotionController.mqttClient;

          if (mqttClient?.connected && cameraSettings?.mqttTopic) {
            mqttClient.publish(
              cameraSettings.mqttTopic,
              JSON.stringify({
                camera: camera.name,
                state: state,
                type: triggerType,
                event: event,
              })
            );
          } else {
            log.debug('No MQTT Publish Topic defined, skip MQTT (motion)..');
          }

          const recordingSettings = await Database.interfaceDB.chain
            .get('settings')
            .get('recordings')
            .cloneDeep()
            .value();

          const recActive = recordingSettings.active || false;
          const recTimer = recordingSettings.timer || 10;

          const timeout = MotionController.#motionTimers.get(camera.name);
          let timeoutConfig =
            (recActive && camera.motionTimeout < recTimer) || camera.useInterfaceTimer
              ? recTimer
              : camera.motionTimeout;

          if (timeout) {
            if (state) {
              log.info('Skip motion event, motion timeout active!', camera.name);
              result.message += ' - Skip motion event, timeout active!';
            } else {
              clearTimeout(timeout);
              MotionController.#motionTimers.delete(camera.name);

              MotionController.#controller.emit('uiMotion', {
                triggerType: triggerType,
                cameraName: camera.name,
                state: state,
              });
            }
          } else {
            if (state) {
              const timer = setTimeout(() => {
                log.debug('Motion handler timeout. (ui)', camera.name);
                MotionController.#motionTimers.delete(camera.name);
              }, (timeoutConfig || 1) * 1000);

              MotionController.#motionTimers.set(camera.name, timer);
            }

            MotionController.#controller.emit('uiMotion', {
              triggerType: triggerType,
              cameraName: camera.name,
              state: state,
            });
          }
        } else {
          result = {
            error: false,
            message: 'Handling through extern controller..',
          };
        }
      }
    } else {
      const message = `Camera '${cameraName}' not found`;

      log.warn(message, cameraName);

      result = {
        error: true,
        message: message,
      };
    }

    return result;
  }
}
