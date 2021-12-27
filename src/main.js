'use-strict';

const compareVersions = require('compare-versions');
const { EventEmitter } = require('events');

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

  static Controller;

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
      this.#startAsWorker();
    }
  }

  async start() {
    this.log.debug(`Initializing camera.ui with PID: ${process.pid}`);

    if (!compareVersions.compare(process.version, '14.18.1', '>=')) {
      this.log.warn(
        `Node.js v16.12.0 or higher is required. You may experience issues running this plugin running on ${process.version}.`,
        'System',
        'system'
      );
    }

    // configure database
    const database = new Database(this);
    this.database = await database.prepareDatabase();

    // configure camera controller
    this.cameraController = new CameraController(this.#socket);

    await Promise.all(
      [...this.cameraController.entries()].map(async (controller) => {
        log.info('Setting up camera, please be patient...', controller[0]);
        await controller[1].media.probe();
        await controller[1].prebuffer?.start();
        await controller[1].stream.configureStreamOptions();
      })
    );

    // configure event controller
    this.eventController = new EventController();

    // configure motion controller
    this.motionController = new MotionController(this);

    // start
    this.#server.listen(config.port);
  }

  close() {
    this.motionController?.closeMqttClient();
    this.motionController?.closeSmtpServer();
    this.motionController?.closeHttpServer();
    this.motionController?.closeFtpServer();

    if (this.cameraController) {
      for (const controller of this.cameraController.values()) {
        controller.prebuffer?.stop(true);
        controller.stream.stop();
      }
    }

    this.#server?.close();
  }

  #startAsWorker() {
    let shuttingDown = false;

    const signalHandler = (signal, signalNumber) => {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;

      setTimeout(() => {
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(128 + signalNumber);
      }, 5000);

      this.close();
    };

    const errorHandler = (error) => {
      if (error.stack) {
        log.error(error.stack, 'System', 'system');
      }

      if (!shuttingDown) {
        process.kill(process.pid, 'SIGTERM');
      }
    };

    this.on('restart', signalHandler.bind(undefined, 'SIGINT', 1));
    process.on('SIGINT', signalHandler.bind(undefined, 'SIGINT', 2));
    process.on('SIGTERM', signalHandler.bind(undefined, 'SIGTERM', 15));
    process.on('uncaughtException', errorHandler);

    this.start();
  }
}

module.exports = new Interface();
