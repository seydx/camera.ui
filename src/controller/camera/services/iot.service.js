'use-strict';

import LoggerService from '../../../services/logger/logger.service.js';

const { log } = LoggerService;

export default class IoTService {
  #camera;
  #controller;

  constructor(camera, controller) {
    //log.debug('Initializing IoT service', camera.name);

    this.#camera = camera;
    this.#controller = controller;

    this.cameraName = camera.name;
  }

  publishMqtt(topic, message) {
    //log.info('publishMqtt', topic, message)
    try {
      const mqttClient = this.#controller.motionController?.mqttClient;

      if (mqttClient?.connected) {
        mqttClient.publish(topic, JSON.stringify(message));
      } else {
        return log.debug('MQTT client not connected, skip MQTT (message)..');
      }
    } catch (error) {
      log.info('An error occured during publishing mqtt message', message, 'events');
      log.error(error, message, 'events');
    }
  }
}
