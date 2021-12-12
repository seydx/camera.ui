const Bunyan = require('bunyan');
const EscapeRegExp = require('lodash.escaperegexp');
const http = require('http');
const mqtt = require('mqtt');
const { parse } = require('url');
const { SMTPServer } = require('smtp-server');
const Stream = require('stream');

const { ConfigService } = require('../../services/config/config.service');
const { LoggerService } = require('../../services/logger/logger.service');

const { Database } = require('../../api/database');

const { EventController } = require('../event/event.controller');

const { log } = LoggerService;

class MotionController {
  static #controller;
  static #motionTimers = new Map();

  static httpServer = null;
  static mqttClient = null;
  static smtpServer = null;

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

    //used for external events
    this.triggerMotion = async (cameraName, state) => {
      let result = {
        error: true,
        message: 'Custom event could not be handled',
      };

      result = await MotionController.#handleMotion('custom', cameraName, state, 'extern', result);

      log.debug(`Received a new EXTERN message ${JSON.stringify(result)} (${cameraName})`);
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
  }

  static startHttpServer() {
    log.debug('Setting up HTTP server for motion detection...');

    const hostname = ConfigService.ui.http.localhttp ? 'localhost' : undefined;

    MotionController.httpServer = http.createServer();

    MotionController.httpServer.on('listening', async () => {
      let addr = MotionController.httpServer.address();
      let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

      log.debug(`HTTP server for motion detection is listening on ${bind}`);
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
    });

    MotionController.httpServer.on('request', async (request, response) => {
      let result = {
        error: true,
        message: `Malformed URL ${request.url}`,
      };

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

          result = await MotionController.#handleMotion(triggerType, cameraName, state, 'http', result);
        }
      }

      log.debug(`Received a new HTTP message ${JSON.stringify(result)} (${cameraName})`);

      response.writeHead(result.error ? 500 : 200);
      response.write(JSON.stringify(result));
      response.end();
    });

    MotionController.httpServer.on('close', () => {
      log.debug('HTTP Server closed');
    });

    MotionController.httpServer.listen(ConfigService.ui.http.port, hostname);
  }

  static startMqttClient() {
    log.debug('Setting up MQTT connection for motion detection...');

    MotionController.mqttClient = mqtt.connect(
      (ConfigService.ui.mqtt.tls ? 'mqtts://' : 'mqtt://') +
        ConfigService.ui.mqtt.host +
        ':' +
        ConfigService.ui.mqtt.port,
      {
        username: ConfigService.ui.mqtt.username,
        password: ConfigService.ui.mqtt.password,
      }
    );

    MotionController.mqttClient.on('connect', () => {
      log.debug('MQTT connected');

      for (const [topic] of ConfigService.ui.topics) {
        log.debug(`Subscribing to MQTT topic: ${topic}`);
        MotionController.mqttClient.subscribe(topic + '/#');
      }
    });

    MotionController.mqttClient.on('message', async (topic, message) => {
      let result = {
        error: true,
        message: `Malformed MQTT message ${message.toString()} (${topic})`,
      };

      let cameraName;

      const cameraMqttConfig = ConfigService.ui.topics.get(topic);

      if (cameraMqttConfig) {
        message = message.toString();

        cameraName = cameraMqttConfig.camera;
        let triggerType = cameraMqttConfig.motion ? 'motion' : 'doorbell';

        let state =
          triggerType === 'doorbell'
            ? true
            : cameraMqttConfig.reset
            ? message === cameraMqttConfig.motionResetMessage
              ? false
              : undefined
            : message === cameraMqttConfig.motionMessage
            ? true
            : message === cameraMqttConfig.motionResetMessage
            ? false
            : undefined;

        result =
          state !== undefined
            ? await MotionController.#handleMotion(triggerType, cameraName, state, 'mqtt', result)
            : {
                error: true,
                message: `The incoming MQTT message (${message}) for the topic (${topic}) was not the same as set in config.json. Skip...`,
              };
      } else {
        result = {
          error: true,
          message: `Can not assign the MQTT topic (${topic}) to a camera!`,
        };
      }

      log.debug(`Received a new MQTT message ${JSON.stringify(result)} (${cameraName})`);
    });

    MotionController.mqttClient.on('end', () => {
      log.debug('MQTT client disconnected');
    });
  }

  static startSmtpServer() {
    log.debug('Setting up SMTP server for motion detection...');

    const regex = new RegExp(EscapeRegExp(ConfigService.ui.smtp.space_replace), 'g');

    const bunyan = Bunyan.createLogger({
      name: 'smtp',
      streams: [
        {
          stream: new Stream.Writable({
            write: (chunk, _encoding, callback) => {
              const data = JSON.parse(chunk);
              log.debug(data.msg);
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
      onData(stream, session, callback) {
        stream.on('data', () => {});
        stream.on('end', callback);

        for (const rcptTo of session.envelope.rcptTo) {
          const name = rcptTo.address.split('@')[0].replace(regex, ' ');
          log.debug(`Email received (${name}).`);

          try {
            http.get(`http://127.0.0.1:${ConfigService.ui.smtp.httpPort}/motion?${name}`);
          } catch (error) {
            log.error(`Error making HTTP call (${name}): ${error}`, 'SMTP Server', 'motion');
          }
        }
      },
    });

    MotionController.smtpServer.listen(ConfigService.ui.smtp.port);
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

  static #getCamera(cameraName) {
    return ConfigService.ui.cameras.find((camera) => camera && camera.name === cameraName);
  }

  static async #handleMotion(triggerType, cameraName, state, event, result) {
    const camera = MotionController.#getCamera(cameraName);

    if (camera) {
      const generalSettings = await Database.interfaceDB.get('settings').get('general').value();
      const atHome = generalSettings?.atHome || false;
      const cameraExcluded = (generalSettings?.exclude || []).includes(cameraName);

      if (atHome && !cameraExcluded) {
        result = {
          error: false,
          message: `Skip motion trigger. At Home is active and ${cameraName} is not excluded!`,
        };
      } else {
        result = {
          error: false,
          message: 'Handled through extern controller',
        };

        MotionController.#controller.emit('motion', cameraName, triggerType, state, event);

        if (camera.recordOnMovement) {
          const timeout = MotionController.#motionTimers.get(camera.name);
          const timeoutConfig = camera.motionTimeout >= 0 ? camera.motionTimeout : 1;

          if (timeout) {
            clearTimeout(timeout);
            MotionController.#motionTimers.delete(camera.name);

            if (state) {
              result.message = 'Skip motion event, timeout active!';
            } else {
              EventController.handle(triggerType, cameraName, state);
            }
          } else {
            if (state && timeoutConfig > 0) {
              const timer = setTimeout(() => {
                log.info('Motion handler timeout.', camera.name);
                MotionController.#motionTimers.delete(camera.name);
              }, timeoutConfig * 1000);

              MotionController.#motionTimers.set(camera.name, timer);
            }

            EventController.handle(triggerType, cameraName, state);
            result.message = 'Handled through intern controller';
          }
        }
      }
    } else {
      result = {
        error: true,
        message: `Camera '${cameraName}' not found`,
      };
    }

    return result;
  }
}

exports.MotionController = MotionController;
