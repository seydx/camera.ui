'use-strict';

const ping = require('ping');

const { LoggerService } = require('../services/logger/logger.service');

const { log } = LoggerService;

class Ping {
  static getHost(videoConfig) {
    let protocol = videoConfig.source.split('-i ')[1].split('://')[0] + '://';
    let host = videoConfig.source.split(protocol)[1];
    let port;

    host = host.includes('@') ? host.split('@')[1].split('/')[0] : host.split('/')[0];

    if (host.includes(':')) {
      port = host.split(':')[1];
      port = port.includes('/') ? port.split('/')[0] : port;
      host = host.split(':')[0];
    }

    return {
      protocol: protocol,
      host: host,
      port: port,
    };
  }

  static async status(cameraName, videoConfig, timeout = 1) {
    const cameraSource = videoConfig.source;

    if (!cameraSource.split('-i ')[1]) {
      return false;
    }

    log.debug(`Incoming ping request for: ${cameraSource.split('-i ')[1]} - Timeout: ${timeout}s`, cameraName);

    //for local cameras eg "-i /dev/video0"
    if (cameraSource.split('-i ')[1].startsWith('/')) {
      return true;
    }

    const addresse = Ping.getHost(videoConfig);
    const protocol = addresse.protocol;
    const host = addresse.host;
    const port = addresse.port;

    log.debug(`Pinging ${protocol}${host}${port ? ':' + port : ''}`, cameraName);

    const response = await ping.promise.probe(host, {
      timeout: timeout || 1,
      extra: ['-i', '2'],
    });

    let available = response && response.alive;

    log.debug(
      `Pinging ${protocol}${host}${port ? ':' + port : ''} - ${available ? 'successful' : 'failed'}`,
      cameraName
    );

    return available;
  }
}

exports.Ping = Ping;
