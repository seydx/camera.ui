'use-strict';

import compareVersions from 'compare-versions';
import { EventEmitter } from 'events';

export default class Interface extends EventEmitter {
  #server;
  #socket;

  constructor(log, config) {
    super();

    this.log = log;
    this.config = config;

    this.cameraController = null;
    this.eventController = null;
    this.motionController = null;

    if (process.env.CUI_SERVICE_MODE === '1') {
      this.#startAsWorker();
    }
  }

  async start() {
    this.emit('config', this.config.json);

    this.log.debug(`Initializing camera.ui with PID: ${process.pid}`);

    if (!compareVersions.compare(process.version, '14.18.1', '>=')) {
      this.log.warn(
        `Node.js v16.12.0 or higher is required. You may experience issues running this plugin running on ${process.version}.`,
        'System',
        'system'
      );
    }

    /**
     * The modules are imported dynamically.
     * They should only be loaded when the user wants to start camera.ui
     */

    // configure server
    this.log.debug('Configuring server...');
    this.#server = new (await import('./api/index.js')).default(this);

    // configure socket
    this.log.debug('Configuring socket...');
    this.#socket = new (await import('./api/socket.js')).default(this.#server);

    // configure database
    this.log.debug('Configuring database...');
    const database = new (await import('./api/database.js')).default(this);
    this.database = await database.prepareDatabase();

    // configure event controller
    this.log.debug('Configuring event controller...');
    this.eventController = new (await import('./controller/event/event.controller.js')).default(this);

    // configure motion controller
    this.log.debug('Configuring motion controller...');
    this.motionController = new (await import('./controller/motion/motion.controller.js')).default(this);

    // configure camera controller
    this.log.debug('Configuring camera controller...');
    this.cameraController = new (await import('./controller/camera/camera.controller.js')).default(this);

    await Promise.all(
      [...this.cameraController.entries()].map(async (controller) => {
        this.log.info('Setting up camera, please be patient...', controller[0]);

        await controller[1].media.probe();

        if (controller[1].options?.disable) {
          return;
        }

        if (controller[1].options.prebuffering) {
          await controller[1].prebuffer.start();
        }

        if (controller[1].options.videoanalysis.active) {
          await controller[1].videoanalysis.start();
        }

        //await controller[1].stream.configureStreamOptions();
      })
    );

    this.log.debug('Starting interface...');
    this.#server.listen(this.config.ui.port);
  }

  /**
   * Stops camera.ui and all started servers and controllers
   */
  async close() {
    await this.database?.interface.write();

    this.motionController?.close();

    if (this.cameraController) {
      for (const controller of this.cameraController.values()) {
        controller.prebuffer.stop(true);
        controller.videoanalysis.stop(true);
        controller.stream.stop();
      }
    }

    this.#server?.close();
  }

  /**
   * Starts camera.ui as "worker" in standalone mode
   */
  #startAsWorker() {
    let shuttingDown = false;

    const signalHandler = async (signal, signalNumber) => {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;

      setTimeout(() => {
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(128 + signalNumber);
      }, 5000);

      await this.close();
    };

    const errorHandler = (error) => {
      if (error.stack) {
        this.log.error(error.stack, 'System', 'system');
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
