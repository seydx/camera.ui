'use-strict';

const { LoggerService } = require('../../../services/logger/logger.service');

const { log } = LoggerService;

class SessionService {
  #camera;

  constructor(camera) {
    //log.debug('Initializing camera session', camera.name);

    this.#camera = camera;
    this.cameraName = camera.name;

    this.session = {
      activeStreams: 0,
      maxStreams: camera.videoConfig.maxStreams,
    };
  }

  requestSession() {
    if (this.session.activeStreams < this.session.maxStreams) {
      log.debug('New stream added to active sessions', this.cameraName);

      this.session.activeStreams++;
      log.debug(`Currently active streams: ${this.session.activeStreams}`, this.cameraName);

      return true;
    }

    log.warn(
      `Starting a new stream process not allowed! ${this.session.activeStreams} processes currently active!`,
      this.cameraName,
      'sessions'
    );

    log.warn(
      `If you want to spawn more than ${this.session.maxStreams} strea processes at same time, please increase "maxStreams" under videoConfig!`,
      this.cameraName,
      'sessions'
    );

    log.debug(`Currently active streams: ${this.session.activeStreams}`, this.cameraName);

    return false;
  }

  closeSession() {
    if (this.session.activeStreams) {
      this.session.activeStreams--;

      log.debug('Stream removed from active sessions', this.cameraName);
      log.debug(`Currently active streams: ${this.session.activeStreams}`, this.cameraName);
    }
  }
}

exports.SessionService = SessionService;
