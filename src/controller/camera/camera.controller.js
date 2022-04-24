'use-strict';

import ConfigService from '../../services/config/config.service.js';

import MediaService from './services/media.service.js';
import PrebufferService from './services/prebuffer.service.js';
import SessionService from './services/session.service.js';
import StreamService from './services/stream.service.js';
import VideoAnalysisService from './services/videoanalysis.service.js';

export default class CameraController {
  static #controller;

  static cameras = new Map([]);

  constructor(controller) {
    CameraController.#controller = controller;

    for (const camera of ConfigService.ui.cameras) {
      CameraController.createController(camera);
    }

    return CameraController.cameras;
  }

  static createController(camera) {
    const mediaService = new MediaService(camera);
    const prebufferService = new PrebufferService(camera, mediaService);
    const videoanalysisService = new VideoAnalysisService(
      camera,
      prebufferService,
      mediaService,
      CameraController.#controller
    );
    const sessionService = new SessionService(camera);
    const streamService = new StreamService(camera, prebufferService, mediaService, sessionService);

    const controller = {
      options: camera,
      media: mediaService,
      videoanalysis: videoanalysisService,
      prebuffer: prebufferService,
      session: sessionService,
      stream: streamService,
    };

    CameraController.cameras.set(camera.name, controller);
  }

  static async removeController(cameraName) {
    const controller = CameraController.cameras.get(cameraName);

    if (!controller) {
      throw new Error(`Can not remove controller, controller for ${cameraName} not found!`);
    }

    controller.prebuffer.destroy();
    controller.videoanalysis.destroy(true);
    controller.stream.destroy();
    controller.session.clearSession();

    CameraController.cameras.delete(cameraName);
  }

  static async startController(cameraName) {
    const controller = CameraController.cameras.get(cameraName);

    if (!controller) {
      throw new Error(`Can not start controller, controller for ${cameraName} not found!`);
    }

    await controller.media.probe();

    if (controller.options?.disable) {
      return;
    }

    if (controller.options?.prebuffering) {
      await controller.prebuffer.start();
    }

    if (controller.options.videoanalysis?.active) {
      await controller.videoanalysis.start();
    }

    //await controller.stream.configureStreamOptions();
  }

  static async reconfigureController(cameraName) {
    const controller = CameraController.cameras.get(cameraName);
    const camera = ConfigService.ui.cameras.find((camera) => camera.name === cameraName);

    if (camera?.disable) {
      return;
    }

    if (!controller) {
      throw new Error(`Can not reconfigure controller, controller for ${cameraName} not found!`);
    }

    if (!camera) {
      throw new Error(`Unexpected error occured during reconfiguring controller for ${cameraName}`);
    }

    controller.options = camera;

    controller.session.reconfigure(camera);
    await controller.media.reconfigure(camera);
    await controller.prebuffer.reconfigure(camera);
    controller.videoanalysis.reconfigure(camera);
    controller.stream.reconfigure(camera);

    CameraController.cameras.set(camera.name, controller);
  }
}
