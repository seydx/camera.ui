'use-strict';

import isEqual from 'lodash/isEqual.js';
import { createServer } from 'net';
import { EventEmitter } from 'events';
import moment from 'moment';
import { spawn } from 'child_process';

import * as cameraUtils from '../utils/camera.utils.js';
import Ping from '../../../common/ping.js';

import LoggerService from '../../../services/logger/logger.service.js';
import ConfigService from '../../../services/config/config.service.js';

import Socket from '../../../api/socket.js';

const { log } = LoggerService;

const compatibleAudio = /(aac|mp3|mp2)/;
const prebufferDurationMs = 15000;

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default class PrebufferService {
  #camera;
  #mediaService;

  prebuffers = {
    mp4: [],
    mpegts: [],
  };
  events = new EventEmitter();
  released = false;
  ftyp = null;
  moov = null;
  idrInterval = 0;
  prevIdr = 0;
  prebufferSession = null;
  killed = false;
  destroyed = false;
  watchdog = null;
  parsers = {};

  cameraState = true;
  restartTimer = null;

  constructor(camera, mediaService) {
    //log.debug('Initializing camera prebuffering', camera.name);

    this.#camera = camera;
    this.#mediaService = mediaService;

    this.cameraName = camera.name;
  }

  reconfigure(camera) {
    const oldVideoConfig = this.#camera.videoConfig;
    const newVideoConfig = camera.videoConfig;

    this.#camera = camera;
    this.cameraName = camera.name;

    if (!isEqual(oldVideoConfig, newVideoConfig) && this.prebufferSession) {
      log.info('Prebuffer: Video configuration changed! Restarting...', this.cameraName);

      this.restart();
    }
  }

  async start() {
    try {
      this.resetPrebuffer();

      this.cameraState = await this.#pingCamera();

      if (!this.cameraState) {
        log.warn(
          'Can not start prebuffering, camera not reachable. Trying again in 60s..',
          this.cameraName,
          'prebuffer'
        );

        this.stop(true);
        setTimeout(() => this.start(), 60000);

        return;
      }

      this.prebufferSession = await this.#startPrebufferSession();

      const timer = this.#millisUntilTime('02:00');

      log.debug(`Prebuffering scheduled for restart at 2AM: ${Math.round(timer / 1000 / 60)} minutes`, this.cameraName);

      this.restartTimer = setTimeout(() => {
        log.info('Sheduled restart of prebuffering is executed...', this.cameraName);
        this.restart();
      }, timer);
    } catch (error) {
      if (error) {
        log.info('An error occured during starting camera prebuffer!', this.cameraName, 'prebuffer');
        log.error(error, this.cameraName, 'prebuffer');
      }
    }
  }

  resetPrebuffer() {
    this.stop(true);

    this.prebufferSession = null;
    this.killed = false;
    this.prebuffers = {
      mp4: [],
      mpegts: [],
    };
    this.released = false;
    this.ftyp = null;
    this.moov = null;
    this.idrInterval = 0;
    this.prevIdr = 0;
    this.events.removeAllListeners();
    this.watchdog = null;
    this.parsers = {};
    this.cameraState = true;
    this.restartTimer = null;
  }

  destroy() {
    this.destroyed = true;
    this.resetPrebuffer();
  }

  stop(killed) {
    if (this.prebufferSession) {
      if (killed) {
        this.killed = true;
      }

      if (this.watchdog) {
        clearTimeout(this.watchdog);
      }

      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }

      this.prebufferSession.kill();
      this.prebufferSession = undefined;
    }
  }

  async restart() {
    if (this.destroyed) {
      return;
    }

    log.info('Restart prebuffer session..', this.cameraName);

    this.stop(true);
    await timeout(10000);
    await this.start();
  }

  async #startPrebufferSession() {
    if (this.prebufferSession) {
      return this.prebufferSession;
    }

    log.debug('Start prebuffering...', this.cameraName);

    const videoConfig = cameraUtils.generateVideoConfig(this.#camera.videoConfig);

    let audioEnabled = videoConfig.audio;
    let acodec = videoConfig.acodec;
    let audioSourceFound = this.#mediaService.codecs.audio.length;
    let probeAudio = this.#mediaService.codecs.audio;
    let incompatibleAudio = audioSourceFound && !probeAudio.some((codec) => compatibleAudio.test(codec));
    let probeTimedOut = this.#mediaService.codecs.timedout;

    let ffmpegInput = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-fflags',
      '+genpts',
      ...cameraUtils.generateInputSource(videoConfig).split(/\s+/),
    ];

    ffmpegInput = cameraUtils.checkDeprecatedFFmpegArguments(this.#mediaService.codecs.ffmpegVersion, ffmpegInput);

    const audioArguments = [];

    /*if (audioEnabled && incompatibleAudio) {
      log.warn(`Skip transcoding audio, incompatible audio detected (${probeAudio.toString()})`, this.cameraName, 'prebuffer');
      audioEnabled = false;
    }*/

    if (!audioSourceFound) {
      if (!probeTimedOut) {
        //acodec = 'copy';
        audioEnabled = false;
      } else if (audioEnabled) {
        log.warn(
          'Turning off audio, audio source not found or timed out during probe stream',
          this.cameraName,
          'prebuffer'
        );
        audioEnabled = false;
      }
    }

    if (audioEnabled) {
      if (incompatibleAudio && acodec !== 'libfdk_aac') {
        log.warn(
          `Incompatible audio stream detected ${probeAudio}, transcoding with "libfdk_aac"..`,
          this.cameraName,
          'prebuffer'
        );
        acodec = 'libfdk_aac';
      } else if (!incompatibleAudio && !acodec) {
        log.info('Compatible audio stream detected, copying..');
        acodec = 'copy';
      }

      if (acodec !== 'copy') {
        audioArguments.push(
          '-bsf:a',
          'aac_adtstoasc',
          '-acodec',
          'libfdk_aac',
          '-profile:a',
          'aac_low',
          '-flags',
          '+global_header',
          '-ar',
          '8k',
          '-b:a',
          '100k',
          '-ac',
          '1'
        );
      } else {
        audioArguments.push('-bsf:a', 'aac_adtstoasc', '-acodec', 'copy');
      }
    } else {
      audioArguments.push('-an');
    }

    const videoArguments = [];

    const probeTimedout = this.#mediaService.codecs.timedout;
    const videoCodecProbe = this.#mediaService.codecs.video[0];
    const forcePrebuffering = this.#camera.forcePrebuffering;

    if (!probeTimedout && videoCodecProbe && !videoCodecProbe.includes('h264')) {
      if (!forcePrebuffering) {
        log.warn(
          `Camera does not support H264 stream (${this.#mediaService.codecs.video.join(
            ', '
          )}). To use prebuffering anyway, enable "forcePrebuffering" in config. Caution: This can lead to a higher CPU load!`,
          this.cameraName,
          'prebuffer'
        );

        return this.stop(true);
      } else {
        log.info('Prebuffering with reencoding enabled! Please pay attention to the CPU load', this.cameraName);

        let vcodec = videoConfig.vcodec === 'copy' ? 'libx264' : videoConfig.vcodec;
        videoArguments.push('-vcodec', vcodec, '-preset:v', 'ultrafast');
      }
    } else {
      videoArguments.push('-vcodec', 'copy');
    }

    this.parsers = {
      mp4: cameraUtils.createFragmentedMp4Parser(),
      mpegts: cameraUtils.createMpegTsParser(),
    };

    const session = await this.#startRebroadcastSession(ffmpegInput, videoConfig, videoArguments, audioArguments, {
      parsers: this.parsers,
    });

    const restartWatchdog = () => {
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        log.error('Prebuffer timed out... killing ffmpeg session', this.cameraName, 'prebuffer');
        session.kill();
      }, 60000);
    };

    session.events.on('mp4-data', restartWatchdog);

    session.events.once('killed', () => {
      this.prebufferSession = undefined;
      session.events.removeListener('mp4-data', restartWatchdog);
      clearTimeout(this.watchdog);
    });

    restartWatchdog();

    for (const container of ['mpegts', 'mp4']) {
      const eventName = container + '-data';
      let prebufferContainer = this.prebuffers[container];
      let shifts = 0;

      session.events.on(eventName, (chunk) => {
        const now = Date.now();

        if (chunk.type === 'mdat') {
          if (this.prevIdr) {
            this.idrInterval = now - this.prevIdr;
          }

          this.prevIdr = now;
        }

        prebufferContainer.push({
          time: now,
          chunk,
        });

        while (prebufferContainer.length > 0 && prebufferContainer[0].time < now - prebufferDurationMs) {
          prebufferContainer.shift();
          shifts++;
        }

        if (shifts > 1000) {
          prebufferContainer = this.prebuffers[container] = [...prebufferContainer];
          shifts = 0;
        }

        this.events.emit(eventName, chunk);
      });
    }

    return session;
  }

  async getVideo(options) {
    if (this.prebufferSession) {
      const requestedPrebuffer = options?.prebuffer * 1000 || Math.max(4000, this.idrInterval || 4000) * 1.5;

      if (options?.prebuffer) {
        log.debug(`Prebuffer requested with a duration of -${requestedPrebuffer / 1000}s`, this.cameraName);
      }

      const createContainerServer = async (container) => {
        const eventName = container + '-data';
        const prebufferContainer = this.prebuffers[container];

        const { server, port } = await this.#createRebroadcaster({
          connect: (writeData, destroy) => {
            server.close();
            const now = Date.now();

            const safeWriteData = (chunk) => {
              const buffered = writeData(chunk);
              if (buffered > 100000000) {
                log.debug(
                  'More than 100MB has been buffered, did downstream die? killing connection.',
                  this.cameraName
                );
                cleanup();
              }
            };

            const cleanup = () => {
              destroy();
              log.debug('Prebuffer request ended', this.cameraName);
              this.events.removeListener(eventName, safeWriteData);
              this.prebufferSession?.events.removeListener('killed', cleanup);
            };

            this.events.on(eventName, safeWriteData);
            this.prebufferSession?.events.once('killed', cleanup);

            const parser = this.parsers[container];
            const availablePrebuffers = parser.findSyncFrame(
              prebufferContainer.filter((pb) => pb.time >= now - requestedPrebuffer).map((pb) => pb.chunk)
            );

            for (const prebuffer of availablePrebuffers) {
              safeWriteData(prebuffer);
            }

            return cleanup;
          },
        });

        setTimeout(() => server.close(), 30000);

        return port;
      };

      const container = options?.container || 'mpegts';
      const url = `tcp://127.0.0.1:${await createContainerServer(container)}`;

      let available = 0;
      const now = Date.now();

      for (const prebuffer of this.prebuffers[container]) {
        if (prebuffer.time < now - requestedPrebuffer) {
          continue;
        }

        for (const chunk of prebuffer.chunk.chunks) {
          available += chunk.length;
        }
      }

      const length = Math.max(500000, available).toString();
      const arguments_ = ['-analyzeduration', '0', '-probesize', length, '-f', container, '-i', url];

      if (options?.ffmpegInputArgs) {
        arguments_.unshift(...options.ffmpegInputArgs);
      }

      if (options?.ffmpegOutputArgs) {
        arguments_.push(...options.ffmpegOutputArgs);
      }

      return arguments_;
    } else {
      throw new Error('Prebuffer process not started!');
    }
  }

  async #createRebroadcaster(options) {
    const server = createServer((socket) => {
      let first = true;

      const writeData = (data) => {
        if (first) {
          first = false;

          if (data.startStream) {
            socket.write(data.startStream);
          }
        }

        for (const chunk of data.chunks) {
          socket.write(chunk);
        }

        return socket.writableLength;
      };

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
        const callback = cleanupCallback;
        cleanupCallback = undefined;
        callback?.();
      };

      let cleanupCallback = options?.connect(writeData, cleanup);

      socket.on('end', cleanup);
      socket.on('close', cleanup);
      socket.on('error', cleanup);
    });

    const port = await cameraUtils.listenServer(server);

    return {
      server,
      port,
    };
  }

  async #startRebroadcastSession(ffmpegInput, videoConfig, videoArguments, audioArguments, options) {
    const events = new EventEmitter();

    let isActive = true;
    let ffmpegTimeout;
    let resolve;
    let reject;

    const socketPromise = new Promise((r, rj) => {
      resolve = r;
      reject = rj;
    });

    const kill = () => {
      isActive = false;

      events.emit('killed');
      cp?.kill('SIGKILL');

      for (const server of servers) {
        server?.close();
      }

      reject();
      clearTimeout(ffmpegTimeout);
    };

    const servers = [];

    let mp4Arguments = '';
    let mpegtsArguments = '';

    ffmpegTimeout = setTimeout(kill, 30000);

    for (const container of Object.keys(options.parsers)) {
      const parser = options.parsers[container];

      const server = createServer(async (socket) => {
        server.close();

        resolve(socket);

        try {
          const eventName = container + '-data';
          for await (const chunk of parser.parse(socket)) {
            events.emit(eventName, chunk);
          }
        } catch (error) {
          if (!error.message?.startsWith('FFMPEG')) {
            log.error(error.message || error, this.cameraName, 'prebuffer');
          } else {
            log.debug(error.message || error, this.cameraName);
          }

          kill();
        }
      });

      servers.push(server);

      const serverPort = await cameraUtils.listenServer(server);
      const containerArguments = `${parser.outputArguments}tcp://127.0.0.1:${serverPort}`;

      if (container === 'mp4') {
        mp4Arguments = containerArguments;
      } else {
        mpegtsArguments = containerArguments;
      }
    }

    let audioMap = `${videoConfig.mapaudio ? videoConfig.mapaudio : '0:a'}?`;
    let videoMap = `${videoConfig.mapvideo ? videoConfig.mapvideo : '0:v'}?`;

    const arguments_ = [
      ...ffmpegInput,
      ...videoArguments,
      ...audioArguments,
      '-f',
      'tee',
      '-map',
      videoMap,
      '-map',
      audioMap,
      `${mp4Arguments}|${mpegtsArguments}`,
    ];

    log.debug(
      `Prebuffering command: ${ConfigService.ui.options.videoProcessor} ${arguments_.join(' ')}`,
      this.cameraName
    );

    let errors = [];

    const cp = spawn(ConfigService.ui.options.videoProcessor, arguments_, {
      env: process.env,
    });

    cp.stderr.on('data', (data) => {
      errors = errors.slice(-5);
      errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, ' - '));
    });

    cp.on('exit', (code, signal) => {
      if (code === 1 || (!this.killed && errors.length > 0)) {
        errors.unshift(`FFmpeg prebuffer process exited with error! (${signal})`);
        log.error(errors.join(' - '), this.cameraName, 'prebuffer');
      } else {
        log.debug('FFmpeg prebuffer process exited (expected)', this.cameraName);
      }
    });

    cp.on('close', () => {
      log.debug('Prebuffering process closed', this.cameraName);

      kill();

      Socket.io.emit('prebufferStatus', {
        camera: this.cameraName,
        status: 'inactive',
      });

      if (!this.killed) {
        this.restart();
      }
    });

    await socketPromise;
    clearTimeout(ffmpegTimeout);

    Socket.io.emit('prebufferStatus', {
      camera: this.cameraName,
      status: 'active',
    });

    return {
      isActive() {
        return isActive;
      },
      events,
      kill,
      servers,
      cp,
    };
  }

  #millisUntilTime(end = '03:00') {
    const startTime = moment();
    const endTime = moment(end, 'HH:mm');

    if ((startTime.hour() >= 12 && endTime.hour() <= 12) || endTime.isBefore(startTime)) {
      endTime.add(1, 'days');
    }

    return endTime.diff(startTime);
  }

  async #pingCamera() {
    let state = true;

    try {
      state = await Ping.status(this.#camera, 1);
    } catch (error) {
      log.info('An error occured during pinging camera, skipping..', this.cameraName);
      log.error(error, this.cameraName);
    }

    return state;
  }
}
