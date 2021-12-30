'use-strict';

const { ConfigService } = require('../../services/config/config.service');

const { MediaService } = require('./services/media.service');
const { PrebufferService } = require('./services/prebuffer.service');
const { SessionService } = require('./services/session.service');
const { StreamService } = require('./services/stream.service');

class CameraController {
  #cameras = ConfigService.ui.cameras;

  static cameras = new Map([]);

  constructor(socket) {
    for (const camera of this.#cameras) {
      this.#createController(camera, socket);
    }

    return CameraController.cameras;
  }

  #createController(camera, socket) {
    const mediaService = new MediaService(camera);
    const prebufferService = new PrebufferService(camera, mediaService, socket);
    const sessionService = new SessionService(camera);
    const streamService = new StreamService(camera, prebufferService, mediaService, sessionService, socket);

    const controller = {
      options: camera,
      media: mediaService,
      prebuffer: prebufferService,
      session: sessionService,
      stream: streamService,
    };

    CameraController.cameras.set(camera.name, controller);
  }
}

exports.CameraController = CameraController;
