const Bunyan = require('bunyan');
const EscapeRegExp = require('lodash.escaperegexp');
const http = require('http');
const mqtt = require('mqtt');
const { parse } = require('url');
const { SMTPServer } = require('smtp-server');
const Stream = require('stream');

const { ConfigService } = require('../../services/config/config.service');
const { LoggerService } = require('../../services/logger/logger.service');

const { EventController } = require('../event/event.controller');

const { log } = LoggerService;

class MotionController {
  #controller;

  #http = ConfigService.ui.http;
  #mqtt = ConfigService.ui.mqtt;
  #smtp = ConfigService.ui.smtp;

  #cameras = ConfigService.ui.cameras;
  #topics = ConfigService.ui.topics;

  static httpServer = null;
  static mqttClient = null;
  static smtpServer = null;

  constructor(controller) {
    this.#controller = controller;

    if (this.#http) {
      this.#startHttpServer();
    }

    if (this.#mqtt) {
      this.#startMqttClient();
    }

    if (this.#smtp) {
      this.#startSmtpServer();
    }

    this.triggerMotion = (cameraName, state) => {
      let result = {
        error: true,
        message: 'Custom event could not be handled',
      };

      result = this.#handleMotion('custom', cameraName, state, 'extern', result);

      log.debug(`Received a new EXTERN message ${JSON.stringify(result)} (${cameraName})`);
    };
  }

  #handleMotion(triggerType, cameraName, state, event, result) {
    const camera = this.#getCamera(cameraName);

    if (camera) {
      result = {
        error: false,
        message: 'Recording disabled for this camera',
      };

      if (triggerType !== 'custom') {
        this.#controller.emit('motion', cameraName, triggerType, state, event);
      }

      if (camera.recordOnMovement) {
        result.message = 'Handled through EventController';

        EventController.handle(triggerType, cameraName, state);
      }
    } else {
      result = {
        error: true,
        message: `Camera '${cameraName}' not found`,
      };
    }

    return result;
  }

  #startHttpServer() {
    log.debug('Setting up HTTP server for motion detection...');

    const hostname = this.#http.localhttp ? 'localhost' : undefined;

    MotionController.httpServer = http.createServer();

    MotionController.httpServer.on('listening', async () => {
      let addr = MotionController.httpServer.address();
      let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

      log.debug(`HTTP server for motion detection is listening on ${bind}`);
    });

    MotionController.httpServer.on('error', (error) => {
      let error_;

      if (error.syscall !== 'listen') {
        log.error(error);
      }

      let bind = typeof port === 'string' ? 'Pipe ' + this.#http.port : 'Port ' + this.#http.port;

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

      log.error(error_);
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

          result = this.#handleMotion(triggerType, cameraName, state, 'http', result);
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

    MotionController.httpServer.listen(this.#http.port, hostname);
  }

  #startMqttClient() {
    log.debug('Setting up MQTT connection for motion detection...');

    EventController.mqttClient = mqtt.connect(
      (this.#mqtt.tls ? 'mqtts://' : 'mqtt://') + this.#mqtt.host + ':' + this.#mqtt.port,
      {
        username: this.#mqtt.username,
        password: this.#mqtt.password,
      }
    );

    EventController.mqttClient.on('connect', () => {
      log.debug('MQTT connected');

      for (const [topic] of this.#topics) {
        log.debug(`Subscribing to MQTT topic: ${topic}`);
        EventController.mqttClient.subscribe(topic + '/#');
      }
    });

    EventController.mqttClient.on('message', async (topic, message) => {
      let result = {
        error: true,
        message: `Malformed MQTT message ${message.toString()} (${topic})`,
      };

      let cameraName;

      const cameraMqttConfig = this.#topics.get(topic);

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
            ? this.#handleMotion(triggerType, cameraName, state, 'mqtt', result)
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

    EventController.mqttClient.on('end', () => {
      log.debug('MQTT client disconnected');
    });
  }

  #startSmtpServer() {
    log.debug('Setting up SMTP server for motion detection...');

    const regex = new RegExp(EscapeRegExp(this.#smtp.space_replace), 'g');

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

    EventController.smtpServer = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
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
            http.get(`http://127.0.0.1:${this.#smtp.httpPort}/motion?${name}`);
          } catch (error) {
            log.error(`Error making HTTP call (${name}): ${error}`);
          }
        }
      },
    });

    EventController.smtpServer.listen(this.#smtp.port);
  }

  #getCamera(cameraName) {
    return this.#cameras.find((camera) => camera && camera.name === cameraName);
  }
}

exports.MotionController = MotionController;
