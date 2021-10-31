'use-strict';

const compareVersions = require('compare-versions');
const { EventEmitter } = require('events');

const { Cleartimer } = require('./common/cleartimer');

const { ConfigService } = require('./services/config/config.service');
const { LoggerService } = require('./services/logger/logger.service');

const { Database } = require('./api/database');
const { Server } = require('./api/index');

//Controller
const { CameraController } = require('./controller/camera/camera.controller');
const { EventController } = require('./controller/event/event.controller');
const { MotionController } = require('./controller/motion/motion.controller');

const { log } = LoggerService;
const { config } = ConfigService;

class Interface extends EventEmitter {
  #server;
  #socket;

  constructor() {
    super();

    this.log = log;

    this.cameraController = null;
    this.eventController = null;
    this.motionController = null;

    const { server, socket } = new Server(this);

    this.#server = server;
    this.#socket = socket;

    if (process.env.CUI_SERVICE_MODE === '1') {
      this.log.debug('Initializing camera.ui in cli-mode');
      this.#cliMode();
    } else {
      this.log.debug('Initializing camera.ui');
    }
  }

  async start() {
    if (!compareVersions.compare(process.version, '14.18.1', '>=')) {
      this.log.warn(
        `Node.js v16.12.0 higher is required. You may experience issues running this plugin running on ${process.version}.`
      );
    }

    // configure database
    const database = new Database();
    this.database = await database.prepareDatabase();

    Cleartimer.start();

    // configure camera controller
    this.cameraController = new CameraController(this.#socket);
    for (const controller of this.cameraController.values()) {
      await controller.prebuffer?.start();
      await controller.stream.configureStreamOptions();
    }

    // configure event controller
    this.eventController = new EventController();

    // configure motion controller
    this.motionController = new MotionController(this);

    // start
    this.#server.listen(config.port);
  }

  close() {
    this.closeMotionController();
    this.closeCameraController();

    if (this.#server) {
      this.#server.close();
    }
  }

  closeMotionController() {
    this.motionController.closeMqttClient();
    this.motionController.closeSmtpServer();
    this.motionController.closeHttpServer();
  }

  closeCameraController() {
    if (this.cameraController) {
      for (const controller of this.cameraController.values()) {
        controller.prebuffer?.stop(true);
        controller.stream.stop();
      }
    }
  }

  #cliMode() {
    let shuttingDown = false;

    const signalHandler = (signal, signalNumber) => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;

      log.info(`Got ${signal}, shutting down camera.ui...`);
      // eslint-disable-next-line unicorn/no-process-exit
      setTimeout(() => process.exit(128 + signalNumber), 5000);

      this.close();
    };

    const errorHandler = (error) => {
      if (error.stack) {
        log.error(error.stack);
      }

      if (!shuttingDown) {
        process.kill(process.pid, 'SIGTERM');
      }
    };

    process.on('SIGINT', signalHandler.bind(undefined, 'SIGINT', 2));
    process.on('SIGTERM', signalHandler.bind(undefined, 'SIGTERM', 15));
    process.on('uncaughtException', errorHandler);

    this.start();
  }
}

module.exports = new Interface();
