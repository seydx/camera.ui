'use-strict';

import nodejsTcpPing from 'nodejs-tcp-ping';
import ping from 'ping';
import { URL } from 'url';

import LoggerService from '../services/logger/logger.service.js';

export default class Ping {
  static async status(camera, timeout = 1) {
    const { log } = LoggerService;

    //fix for non-break-spaces
    let cameraSource = camera.videoConfig.source.replace(/\u00A0/g, ' ').split('-i ')[1];

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

    log.debug(`Pinging ${url.hostname}:${url.port || 80}`, camera.name);

    let available = false;

    try {
      const response = await nodejsTcpPing.tcpPing({
        attempts: 5,
        host: url.hostname,
        port: Number.parseInt(url.port) || 80,
        timeout: (timeout || 1) * 1000,
      });

      available = response.filter((result) => result.ping).length > 2;
    } catch {
      //ignore
    }

    if (!available) {
      const response = await ping.promise.probe(url.hostname, {
        timeout: timeout || 1,
        extra: ['-i', '2'],
      });

      available = response && response.alive;
    }

    log.debug(`Pinging ${url.hostname}:${url.port || 80} - ${available ? 'successful' : 'failed'}`, camera.name);

    return available;
  }
}
