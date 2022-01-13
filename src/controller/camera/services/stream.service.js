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

    const videoConfig = cameraUtils.generateVideoConfig(this.#camera.videoConfig);
    let ffmpegInput = [...cameraUtils.generateInputSource(videoConfig).split(/\s+/)];
    let prebuffer = null;

    if (this.#camera.prebuffering && this.#prebufferService) {
      try {
        const containerInput = await this.#prebufferService.getVideo({
          container: 'mpegts',
        });

        ffmpegInput = prebuffer = containerInput;
      } catch {
        //ignore
      }
    }

    const videoArguments = ['-f', 'mpegts', '-vcodec', 'mpeg1video'];

    if (videoConfig.mapvideo && !prebuffer) {
      videoArguments.unshift('-map', videoConfig.mapvideo);
    }

    const audioArguments = [];

    if (cameraSetting?.audio && this.#mediaService.codecs.audio.length > 0) {
      audioArguments.push('-acodec', 'mp2', '-ac', '1', '-b:a', '128k');
    }

    if (videoConfig.mapaudio && !prebuffer) {
      audioArguments.unshift('-map', videoConfig.mapaudio);
    }

    const additionalFlags = [
      '-s',
      cameraSetting?.resolution ? cameraSetting.resolution : `${videoConfig.maxWidth}x${videoConfig.maxHeight}`,
      '-b:v',
      `${videoConfig.maxBitrate}k`,
      '-r',
      videoConfig.maxFPS,
      '-bf',
      '0',
      '-preset:v',
      'ultrafast',
      '-threads',
      '1',
      '-q',
      '1',
      '-max_muxing_queue_size',
      '1024',
    ];

    return {
      ffmpegInput,
      prebuffer,
      audioArguments,
      videoArguments,
      additionalFlags,
    };
  }

  async start() {
    if (!this.streamSession) {
      let { ffmpegInput, prebuffer, audioArguments, videoArguments, additionalFlags } =
        await this.configureStreamOptions();

      /*if (!prebuffer) {
        const allowStream = this.#sessionService.requestSession();
        if (!allowStream) {
          log.error('Not allowed to start stream. Session limit exceeded!', this.cameraName, 'streams');
          return;
        }
      }*/

      const spawnOptions = [
        '-hide_banner',
        '-loglevel',
        'error',
        ...ffmpegInput,
        ...videoArguments,
        ...audioArguments,
        ...additionalFlags,
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

        if (!prebuffer) {
          this.#sessionService.closeSession();
        }
      });
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
}

exports.StreamService = StreamService;
