'use-strict';

const { EventEmitter } = require('events');
const { createServer, Server } = require('net');
const { spawn } = require('child_process');

const cameraUtils = require('../utils/camera.utils');

const { LoggerService } = require('../../../services/logger/logger.service');
const { ConfigService } = require('../../../services/config/config.service');

const { log } = LoggerService;

const videoDuration = 25000;
const compatibleAudio = /(aac|mp3|mp2)/;

class PrebufferService {
  #camera;
  #mediaService;
  #videoProcessor = ConfigService.ui.options.videoProcessor;

  prebufferFmp4 = [];
  events = new EventEmitter();
  released = false;
  ftyp = null;
  moov = null;
  idrInterval = 0;
  prevIdr = 0;
  prebufferSession = null;
  killed = false;

  constructor(camera, mediaService) {
    //log.debug('Initializing camera prebuffering', camera.name);

    this.#camera = camera;
    this.#mediaService = mediaService;

    this.cameraName = camera.name;
    this.debug = camera.videoConfig.debug;
    this.ffmpegInput = camera.videoConfig.source;
  }

  async start() {
    try {
      this.prebufferSession = await this.startPrebufferSession();
    } catch (error) {
      log.warn('An error occured during starting camera prebuffer!', this.cameraName);
      log.error(error, this.cameraName);

      setTimeout(() => this.restartCamera(), 10000);
    }
  }

  resetPrebuffer() {
    this.prebufferFmp4 = [];
    this.released = false;
    this.ftyp = null;
    this.moov = null;
    this.idrInterval = 0;
    this.prevIdr = 0;
  }

  stop(killed) {
    if (this.prebufferSession) {
      const process = this.prebufferSession.process;
      const server = this.prebufferSession.server;

      if (killed) {
        this.killed = true;
      }

      if (process) {
        process.kill();
      }

      if (server) {
        server.close();
      }

      this.resetPrebuffer();

      this.prebufferSession = null;
    }
  }

  restart() {
    this.stop(false);
    setTimeout(() => this.start(), 5000);
  }

  async startPrebufferSession() {
    if (this.prebufferSession) {
      return this.prebufferSession;
    }

    log.debug('Start prebuffering...', this.cameraName);

    let audioEnabled = this.#camera.videoConfig.audio;
    let acodec = this.#camera.videoConfig.acodec || 'libfdk_aac';
    let audioSourceFound = this.#mediaService.codecs.audio.length;
    let probeAudio = this.#mediaService.codecs.audio;
    let incompatibleAudio = audioSourceFound && !probeAudio.some((codec) => compatibleAudio.test(codec));
    let probeTimedOut = this.#mediaService.codecs.timedout;

    const audioArguments = [];

    /*if (audioEnabled && incompatibleAudio) {
      log.warn(`Skip transcoding audio, incompatible audio detected (${probeAudio.toString()})`, this.cameraName);
      audioEnabled = false;
    }*/

    if (audioEnabled && acodec === 'copy' && incompatibleAudio) {
      log.warn('Can not copy non AAC typed audio, reencoding..');
      acodec = 'libfdk_aac';
    }

    if (!audioSourceFound) {
      if (!probeTimedOut) {
        audioEnabled = true;
        acodec = 'copy';
      } else {
        audioEnabled = false;
      }
    }

    if (audioEnabled) {
      if (acodec !== 'copy') {
        audioArguments.push('-acodec', 'libfdk_aac', '-profile:a', 'aac_low');
      } else {
        audioArguments.push('-acodec', 'copy');
      }
    } else {
      audioArguments.push('-an');
    }

    const videoArguments = ['-vcodec', 'copy'];

    const fmp4OutputServer = createServer(async (socket) => {
      fmp4OutputServer.close();

      try {
        const parser = cameraUtils.parseFragmentedMP4(socket);

        for await (const atom of parser) {
          const now = Date.now();

          if (!this.ftyp) {
            this.ftyp = atom;
          } else if (!this.moov) {
            this.moov = atom;
          } else {
            if (atom.type === 'mdat') {
              if (this.prevIdr) {
                this.idrInterval = now - this.prevIdr;
              }

              this.prevIdr = now;
            }

            this.prebufferFmp4.push({
              atom,
              time: now,
            });
          }

          if (this.prebufferFmp4.length > 0 && this.prebufferFmp4[0].time < now - videoDuration) {
            this.prebufferFmp4.shift();
          }

          this.events.emit('atom', atom);
        }
      } catch (error) {
        log.debug(error, this.cameraName);
      }
    });

    const fmp4Port = await cameraUtils.listenServer(fmp4OutputServer);
    const destination = `tcp://127.0.0.1:${fmp4Port}`;

    const ffmpegOutput = [
      '-f',
      'mp4',
      ...videoArguments,
      ...audioArguments,
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      destination,
    ];

    const arguments_ = ['-hide_banner', '-loglevel', 'error', ...this.ffmpegInput.split(' '), ...ffmpegOutput];

    log.debug(`Prebuffering command: ${this.#videoProcessor} ${arguments_.join(' ')}`, this.cameraName);

    const cp = spawn(this.#videoProcessor, arguments_, { env: process.env });

    if (this.debug) {
      cp.stdout.on('data', (data) => log.debug(data.toString(), this.cameraName));
    }

    cp.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), this.cameraName));

    cp.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg prebuffer process exited with error! (${signal})`, this.cameraName);
      } else {
        log.debug('FFmpeg prebuffer process exited (expected)', this.cameraName);
      }
    });

    cp.on('close', () => {
      log.debug('Prebufferring process closed', this.cameraName);

      if (!this.killed) {
        this.restart();
      }
    });

    return { server: fmp4OutputServer, process: cp };
  }

  async getVideo(requestedPrebuffer = 6000) {
    if (this.prebufferSession) {
      log.debug(`Prebuffer requested with a duration of -${requestedPrebuffer / 1000}s`, this.cameraName);

      const server = new Server((socket) => {
        server.close();

        const writeAtom = (atom) => {
          socket.write(Buffer.concat([atom.header, atom.data]));
        };

        if (this.ftyp) {
          writeAtom(this.ftyp);
        }

        if (this.moov) {
          writeAtom(this.moov);
        }

        const now = Date.now();
        let needMoof = true;

        for (const prebuffer of this.prebufferFmp4) {
          if (prebuffer.time < now - requestedPrebuffer) {
            continue;
          }

          if (needMoof && prebuffer.atom.type !== 'moof') {
            continue;
          }

          needMoof = false;

          writeAtom(prebuffer.atom);
        }

        this.events.on('atom', writeAtom);

        const cleanup = () => {
          log.debug('Prebuffer request ended', this.cameraName);

          this.events.removeListener('atom', writeAtom);
          this.events.removeListener('killed', cleanup);

          socket.removeAllListeners();
          socket.destroy();
        };

        this.events.once('killed', cleanup);

        socket.once('end', cleanup);
        socket.once('close', cleanup);
        socket.once('error', cleanup);
      });

      setTimeout(() => server.close(), 30000);

      const port = await cameraUtils.listenServer(server);

      const ffmpegInput = ['-f', 'mp4', '-i', `tcp://127.0.0.1:${port}`];

      return ffmpegInput;
    } else {
      throw new Error('Prebuffer process not started!');
    }
  }
}

exports.PrebufferService = PrebufferService;
