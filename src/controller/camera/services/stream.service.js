'use-strict';

const { spawn } = require('child_process');

const { ConfigService } = require('../../../services/config/config.service');
const { LoggerService } = require('../../../services/logger/logger.service');

const { Database } = require('../../../api/database');
const { Socket } = require('../../../api/socket');

const { log } = LoggerService;

class StreamService {
  #camera;
  #sessionService;

  #videoProcessor = ConfigService.ui.options.videoProcessor;
  #interfaceDB = Database.interfaceDB;

  streamSession = null;

  constructor(camera, sessionService) {
    log.debug('Initializing camera stream', camera.name);

    this.#camera = camera;
    this.#sessionService = sessionService;

    const audio = camera.videoConfig.audio;
    const width = camera.videoConfig.maxWidth;
    const height = camera.videoConfig.maxHeight;
    const rate = camera.videoConfig.maxFPS;

    this.cameraName = camera.name;
    this.debug = camera.videoConfig.debug;

    this.streamOptions = {
      source: camera.videoConfig.source,
      ffmpegOptions: {
        '-s': `${width}x${height}`,
        '-b:v': '299k',
        '-r': rate,
        '-bf': 0,
        '-an': '',
        '-preset:v': 'ultrafast',
        '-threads': '1',
        '-loglevel': 'error',
      },
    };

    if (audio) {
      delete this.streamOptions.ffmpegOptions['-an'];

      this.streamOptions.ffmpegOptions = {
        ...this.streamOptions.ffmpegOptions,
        '-codec:a': 'mp2',
        '-ar': '44100',
        '-ac': '1',
        '-b:a': '128k',
      };
    }
  }

  async configureStreamOptions() {
    const cameraSettings = await this.#interfaceDB.get('cameras').value();
    const cameraSetting = cameraSettings.find((camera) => camera && camera.name === this.cameraName);

    if (cameraSetting) {
      if (cameraSetting.resolution) {
        this.streamOptions.ffmpegOptions['-s'] = cameraSetting.resolution;
      }

      if (cameraSetting.audio) {
        delete this.streamOptions.ffmpegOptions['-an'];

        this.streamOptions.ffmpegOptions = {
          ...this.streamOptions.ffmpegOptions,
          '-codec:a': 'mp2',
          '-ar': '44100',
          '-ac': '1',
          '-b:a': '128k',
        };
      }
    }
  }

  start() {
    if (!this.stream) {
      const allowStream = this.#sessionService.requestSession();

      if (allowStream) {
        const additionalFlags = [];

        if (this.streamOptions.ffmpegOptions) {
          for (const key of Object.keys(this.streamOptions.ffmpegOptions)) {
            additionalFlags.push(key, this.streamOptions.ffmpegOptions[key]);
          }
        }

        const spawnOptions = [
          ...this.streamOptions.source.split(' '),
          '-f',
          'mpegts',
          '-codec:v',
          'mpeg1video',
          ...additionalFlags,
          '-q',
          '1',
          '-hide_banner',
          '-max_muxing_queue_size',
          '1024',
          '-',
        ].filter((key) => key !== '');

        log.debug(
          `Stream command: ${this.#videoProcessor} ${spawnOptions.toString().replace(/,/g, ' ')}`,
          this.cameraName
        );

        this.streamSession = spawn(this.#videoProcessor, spawnOptions, {
          env: process.env,
        });

        this.streamSession.stdout.on('data', (data) => {
          Socket.io.to(`stream/${this.cameraName}`).emit(this.cameraName, data);

          if (this.debug) {
            log.debug(data.toString(), this.cameraName);
          }
        });

        this.streamSession.stderr.on('data', (data) =>
          log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), this.cameraName)
        );

        this.streamSession.on('exit', (code, signal) => {
          if (code === 1) {
            log.error(`Stream exited with error! (${signal})`, this.cameraName);
          } else {
            log.debug('Stream exit (expected)', this.cameraName);
          }

          this.streamSession = null;
          this.#sessionService.closeSession();
        });
      } else {
        log.error('Not allowed to start stream. Session limit exceeded!', this.cameraName);
      }
    }
  }

  stop() {
    if (this.streamSession) {
      log.debug('Stopping stream..', this.cameraName);
      this.streamSession.kill();
    }
  }

  setStreamSource(source) {
    if (source.inludes('-i')) {
      this.streamOptions.source = source.split(' ');
    } else {
      log.warn(`Source ${source} is not valid, skipping`);
    }
  }

  setStreamOptions(options) {
    for (const [key, value] of Object.entries(options)) {
      this.streamOptions.ffmpegOptions[key] = value;
    }
  }

  delStreamOptions(options) {
    for (const property of options) {
      delete this.streamOptions.ffmpegOptions[property];
    }
  }
}

exports.StreamService = StreamService;
