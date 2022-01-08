'use-strict';

const ping = require('ping');
const { URL } = require('url');

const { LoggerService } = require('../services/logger/logger.service');

const { log } = LoggerService;

class Ping {
  static async status(camera, timeout = 1) {
    let cameraSource = camera.videoConfig.source.split('-i ')[1];

    if (!cameraSource) {
      log.warn(`Can not ping camera source, no source found (${camera.videoConfig.source})`, camera.name);
      return false;
    }

    log.debug(`Incoming ping request for: ${cameraSource} - Timeout: ${timeout}s`, camera.name);

    //for local cameras eg "-i /dev/video0"
    if (cameraSource.startsWith('/')) {
      log.debug(`Pinging ${cameraSource} - successfull`, camera.name);
      return true;
    }

    const url = new URL(cameraSource);

    log.debug(`Pinging ${url.hostname}`, camera.name);

    const response = await ping.promise.probe(url.hostname, {
      timeout: timeout || 1,
      extra: ['-i', '2'],
    });

    let available = response && response.alive;

    log.debug(`Pinging ${url.hostname} - ${available ? 'successful' : 'failed'}`, camera.name);

    return available;
  }
}

exports.Ping = Ping;
