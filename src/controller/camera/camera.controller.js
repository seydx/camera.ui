'use-strict';

const { ConfigService } = require('../../services/config/config.service');

const { MediaService } = require('./services/media.service');
const { PrebufferService } = require('./services/prebuffer.service');
const { SessionService } = require('./services/session.service');
const { StreamService } = require('./services/stream.service');

class CameraController {
  static #socket;

  static cameras = new Map([]);

  constructor(socket) {
    CameraController.#socket = socket;

    for (const camera of ConfigService.ui.cameras) {
      CameraController.createController(camera, socket);
    }

    return CameraController.cameras;
  }

  static createController(camera) {
    const mediaService = new MediaService(camera);
    const prebufferService = new PrebufferService(camera, mediaService, CameraController.#socket);
    const sessionService = new SessionService(camera);
    const streamService = new StreamService(
      camera,
      prebufferService,
      mediaService,
      sessionService,
      CameraController.#socket
    );

    const controller = {
      options: camera,
      media: mediaService,
      prebuffer: prebufferService,
      session: sessionService,
      stream: streamService,
    };

    CameraController.cameras.set(camera.name, controller);
  }

  static async startController(cameraName) {
    const controller = CameraController.cameras.get(cameraName);

    if (!controller) {
      throw new Error(`Camera controller for ${cameraName} not found!`);
    }

    await controller.media.probe();

    if (controller.options.prebuffering) {
      await controller.prebuffer?.start();
    }

    await controller.stream.configureStreamOptions();
  }
}

exports.CameraController = CameraController;
