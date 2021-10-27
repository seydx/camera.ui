'use-strict';

const { ConfigService } = require('../../services/config/config.service');

const { PrebufferService } = require('./services/prebuffer.service');
const { SessionService } = require('./services/session.service');
const { StreamService } = require('./services/stream.service');

class CameraController {
  #cameras = ConfigService.ui.cameras;

  static cameras = new Map([]);

  constructor() {
    for (const camera of this.#cameras) {
      this.#createController(camera);
    }

    return CameraController.cameras;
  }

  #createController(camera) {
    const prebufferService = camera.prebuffering ? new PrebufferService(camera) : null;
    const sessionService = new SessionService(camera);
    const streamService = new StreamService(camera, sessionService);

    const controller = {
      prebuffer: prebufferService,
      session: sessionService,
      stream: streamService,
    };

    CameraController.cameras.set(camera.name, controller);
  }
}

exports.CameraController = CameraController;
