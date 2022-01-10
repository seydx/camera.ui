'use-strict';

const _ = require('lodash');
const cameraUtils = require('../utils/camera.utils');
const { spawn } = require('child_process');

const { ConfigService } = require('../../../services/config/config.service');
const { LoggerService } = require('../../../services/logger/logger.service');

const { Database } = require('../../../api/database');

const { log } = LoggerService;

class StreamService {
  #socket;
  #camera;
  #prebufferService;
  #sessionService;
  #mediaService;

  streamSession = null;

  constructor(camera, prebufferService, mediaService, sessionService, socket) {
    //log.debug('Initializing camera stream', camera.name);

    this.#camera = camera;
    this.#socket = socket;
    this.#sessionService = sessionService;
    this.#mediaService = mediaService;
    this.#prebufferService = prebufferService;

    this.cameraName = camera.name;
    this.streamOptions = {};
  }

  reconfigure(camera) {
    const oldVideoConfig = this.#camera.videoConfig;
    const newVideoConfig = camera.videoConfig;

    this.#camera = camera;
    this.cameraName = camera.name;

    if (!_.isEqual(oldVideoConfig, newVideoConfig) && this.streamSession) {
      log.info('Stream: Video configuration changed! Restarting...', this.cameraName);

      this.restart();
    }
  }

  async configureStreamOptions() {
    await Database.interfaceDB.read();

    const Settings = await Database.interfaceDB.get('settings').get('cameras').value();
    const cameraSetting = Settings.find((camera) => camera && camera.name === this.cameraName);

    this.streamOptions = {
      source: cameraUtils.generateInputSource(this.#camera.videoConfig),
      ffmpegOptions: {
        '-s': cameraSetting?.resolution
          ? cameraSetting.resolution
          : `${this.#camera.videoConfig.maxWidth}x${this.#camera.videoConfig.maxHeight}`,
        '-b:v': `${this.#camera.videoConfig.maxBitrate}k`,
        '-r': this.#camera.videoConfig.maxFPS,
        '-bf': 0,
        '-preset:v': 'ultrafast',
        '-threads': '1',
      },
    };

    if (this.#camera.videoConfig.mapvideo) {
      this.streamOptions.ffmpegOptions['-map'] = this.#camera.videoConfig.mapvideo;
    }

    if (this.#camera.videoConfig.videoFilter) {
      this.streamOptions.ffmpegOptions['-filter:v'] = this.#camera.videoConfig.videoFilter;
    }

    if (cameraSetting?.audio && this.#mediaService.codecs.audio.length > 0) {
      delete this.streamOptions.ffmpegOptions['-an'];

      this.streamOptions.ffmpegOptions = {
        ...this.streamOptions.ffmpegOptions,
        '-codec:a': 'mp2',
        '-ar': '44100',
        '-ac': '1',
        '-b:a': '128k',
      };
    } else {
      delete this.streamOptions.ffmpegOptions['-codec:a'];
      delete this.streamOptions.ffmpegOptions['-ar'];
      delete this.streamOptions.ffmpegOptions['-ac'];
      delete this.streamOptions.ffmpegOptions['-b:a'];

      this.streamOptions.ffmpegOptions['-an'] = '';
    }
  }

  async start() {
    if (!this.streamSession) {
      const allowStream = this.#sessionService.requestSession();

      if (allowStream) {
        await this.configureStreamOptions();

        let input = this.streamOptions.source.split(/\s+/);

        if (this.#camera.prebuffering && this.#prebufferService) {
          try {
            log.debug('Setting prebuffer stream as input', this.cameraName);

            const containerInput = await this.#prebufferService.getVideo({
              container: 'mpegts',
            });

            input = containerInput;

            delete this.streamOptions.ffmpegOptions['-map'];
            delete this.streamOptions.ffmpegOptions['-filter:v'];
          } catch (error) {
            log.warn(`Can not access prebuffer stream, skipping: ${error}`, this.cameraName);
          }
        }

        const additionalFlags = [];

        if (this.streamOptions.ffmpegOptions) {
          for (const key of Object.keys(this.streamOptions.ffmpegOptions)) {
            additionalFlags.push(key, this.streamOptions.ffmpegOptions[key]);
          }
        }

        if (this.#camera.videoConfig.mapaudio) {
          additionalFlags.push('-map', this.#camera.videoConfig.mapaudio);
        }

        const spawnOptions = [
          '-hide_banner',
          '-loglevel',
          'error',
          ...input,
          '-f',
          'mpegts',
          '-codec:v',
          'mpeg1video',
          ...additionalFlags,
          '-q',
          '1',
          '-max_muxing_queue_size',
          '1024',
          '-',
        ].filter((key) => key !== '');

        log.debug(
          `Stream command: ${ConfigService.ui.options.videoProcessor} ${spawnOptions.join(' ')}`,
          this.cameraName
        );

        this.streamSession = spawn(ConfigService.ui.options.videoProcessor, spawnOptions, {
          env: process.env,
        });

        const errors = [];

        this.streamSession.stdout.on('data', (data) => {
          this.#socket.to(`stream/${this.cameraName}`).emit(this.cameraName, data);
        });

        this.streamSession.stderr.on('data', (data) => errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, '')));

        this.streamSession.on('exit', (code, signal) => {
          if (code === 1) {
            errors.unshift(`Stream exited with error! (${signal})`);
            log.error(errors.join(' - '), this.cameraName, 'streams');
          } else {
            log.debug('Stream exit (expected)', this.cameraName);
          }

          this.streamSession = null;
          this.#sessionService.closeSession();
        });
      } else {
        log.error('Not allowed to start stream. Session limit exceeded!', this.cameraName, 'streams');
      }
    }
  }

  stop() {
    if (this.streamSession) {
      log.debug('Stopping stream..', this.cameraName);
      this.streamSession.kill('SIGKILL');
    }
  }

  restart() {
    log.info('Restart stream session..', this.cameraName);

    if (this.streamSession) {
      this.stop();
      setTimeout(() => this.start(), 1500);
    } else {
      this.start();
    }
  }

  setStreamSource(source) {
    if (source.inludes('-i')) {
      this.streamOptions.source = source.split(/\s+/);
    } else {
      log.warn(`Source ${source} is not valid, skipping`, this.cameraName, 'streams');
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
