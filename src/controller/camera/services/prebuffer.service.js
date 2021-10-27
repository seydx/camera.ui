'use-strict';

const { EventEmitter } = require('events');
const { createServer, Server } = require('net');
const { spawn } = require('child_process');

const cameraUtils = require('../utils/camera.utils');

const { LoggerService } = require('../../../services/logger/logger.service');
const { ConfigService } = require('../../../services/config/config.service');

const { log } = LoggerService;

const videoDuration = 10000;

class PrebufferService {
  #camera;
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

  constructor(camera) {
    log.debug('Initializing camera prebuffering', camera.name);

    this.#camera = camera;

    this.cameraName = camera.name;
    this.debug = camera.videoConfig.debug;
    this.ffmpegInput = camera.videoConfig.source;
  }

  async start() {
    try {
      this.prebufferSession = await this.startPrebufferSession();
    } catch (error) {
      log.warn('An error occurrd during starting camera prebuffer!', this.cameraName);
      //log.error(error, this.cameraName);

      console.log(error);

      setTimeout(() => this.restartCamera(), 10000);
    }
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

    //const acodec = ['-acodec', 'copy'];
    const vcodec = ['-vcodec', 'copy'];

    const fmp4OutputServer = createServer(async (socket) => {
      fmp4OutputServer.close();

      try {
        const parser = cameraUtils.parseFragmentedMP4(this.cameraName, socket);

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

          while (this.prebufferFmp4.length > 0 && this.prebufferFmp4[0].time < now - videoDuration) {
            this.prebufferFmp4.shift();
          }

          this.events.emit('atom', atom);
        }
      } catch (error) {
        log.debug(error, this.cameraName);
      }
    });

    const fmp4Port = await cameraUtils.listenServer(this.cameraName, fmp4OutputServer);
    const destination = `tcp://127.0.0.1:${fmp4Port}`;

    const ffmpegOutput = [
      '-loglevel',
      'error',
      '-f',
      'mp4',
      //...acodec,
      ...vcodec,
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      destination,
    ];

    const arguments_ = ['-hide_banner'];
    arguments_.push(...this.ffmpegInput.split(' '), ...ffmpegOutput);

    log.debug(`Prebuffering command: ${this.#videoProcessor} ${arguments_.join(' ')}`, this.cameraName);

    const cp = spawn(this.#videoProcessor, arguments_, { env: process.env });

    if (this.debug) {
      cp.stdout.on('data', (data) => log.debug(data.toString(), this.cameraName));
      //cp.stderr.on('data', (data) => log.debug(data.toString(), this.cameraName));
    }

    cp.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), this.cameraName));

    cp.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg prebuffer process exited with error! (${signal})`, this.cameraName);
      } else {
        log.debug('FFmpeg prebuffer process exit (expected)', this.cameraName);
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

  async getVideo(requestedPrebuffer = 4000) {
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

      const port = await cameraUtils.listenServer(this.cameraName, server);
      const ffmpegInput = ['-f', 'mp4', '-i', `tcp://127.0.0.1:${port}`];

      return ffmpegInput;
    } else {
      throw new Error('Prebuffer process not started!');
    }
  }
}

exports.PrebufferService = PrebufferService;
