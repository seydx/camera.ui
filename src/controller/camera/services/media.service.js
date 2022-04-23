'use-strict';

import readline from 'readline';
import { spawn } from 'child_process';

import LoggerService from '../../../services/logger/logger.service.js';
import ConfigService from '../../../services/config/config.service.js';

const { log } = LoggerService;

export default class MediaService {
  #camera;

  constructor(camera) {
    //log.debug('Initializing camera probe', camera.name);

    this.#camera = camera;
    this.cameraName = camera.name;

    this.codecs = {
      ffmpegVersion: null,
      probe: false,
      timedout: false,
      audio: [],
      video: [],
      bitrate: '? kb/s',
      mapvideo: '',
      mapaudio: '',
    };
  }

  async reconfigure(camera) {
    const oldVideoConfigSubSource = this.#camera.videoConfig.subSource;
    const newVideoConfigSubSource = camera.videoConfig.subSource;

    this.#camera = camera;
    this.cameraName = camera.name;

    if (oldVideoConfigSubSource !== newVideoConfigSubSource) {
      log.info('Probe: Video source changed! Probe stream...', this.cameraName);
      await this.probe();
    }
  }

  async probe() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      let lines = 0;

      const arguments_ = [
        '-analyzeduration',
        '0',
        '-probesize',
        '5000',
        ...this.#camera.videoConfig.source.split(/\s+/),
      ];

      log.debug(`Probe stream: ${ConfigService.ui.options.videoProcessor} ${arguments_.join(' ')}`, this.cameraName);

      let cp = spawn(ConfigService.ui.options.videoProcessor, arguments_, {
        env: process.env,
      });

      const stderr = readline.createInterface({
        input: cp.stderr,
        terminal: false,
      });

      stderr.on('line', (line) => {
        if (lines === 0) {
          this.codecs.ffmpegVersion = ConfigService.ffmpegVersion = line.split(' ')[2];
        }

        const bitrateLine = line.includes('start: ') && line.includes('bitrate: ') ? line.split('bitrate: ')[1] : false;

        if (bitrateLine) {
          this.codecs.bitrate = bitrateLine;
        }

        const audioLine = line.includes('Audio: ') ? line.split('Audio: ')[1] : false;

        if (audioLine) {
          this.codecs.audio = audioLine.split(', ');
          this.codecs.mapaudio = line.split('Stream #')[1]?.split(': Audio')[0];
        }

        const videoLine = line.includes('Video: ') ? line.split('Video: ')[1] : false;

        if (videoLine) {
          this.codecs.video = videoLine.split(', ');
          this.codecs.mapvideo = line.split('Stream #')[1]?.split(': Video')[0];
        }

        lines++;
      });

      cp.on('exit', () => {
        this.codecs.probe = true;
        log.debug(this.codecs, this.cameraName);

        cp = null;

        resolve(this.codecs);
      });

      setTimeout(() => {
        if (cp) {
          log.warn('Can not determine stream codecs, probe timed out', this.cameraName, 'ffmpeg');

          this.codecs.timedout = true;
          cp.kill('SIGKILL');
        }
      }, 10000);
    });
  }
}
