'use-strict';

import isEqual from 'lodash/isEqual.js';
import moment from 'moment';
import P2P from 'pipe2pam';
import PamDiff from 'pam-diff';
import { spawn } from 'child_process';

import * as cameraUtils from '../utils/camera.utils.js';
import Ping from '../../../common/ping.js';

import Database from '../../../api/database.js';

import LoggerService from '../../../services/logger/logger.service.js';
import ConfigService from '../../../services/config/config.service.js';

import MotionController from '../../motion/motion.controller.js';

import Socket from '../../../api/socket.js';

const { log } = LoggerService;

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isUINT = (value) => Number.isInteger(value) && value >= 0;

const FFMPEG_MODE = 'rgb24'; // gray, rgba, rgb24
const FFMPEG_RESOLUTION = '640:360';
const FFMPEG_FPS = '2';

const DEFAULT_FORCECLOSE_TIME = 3;
const DEFAULT_DWELL_TIME = 60;
const DEFAULT_DIFFERENCE = 5; // 1 - 255
const DEFAULT_SENSITIVITY = 75; // 0 - 100
const DEFAULT_ZONE = [
  {
    name: 'region0',
    finished: true,
    coords: [
      [0, 100],
      [0, 0],
      [100, 0],
      [100, 100],
    ],
  },
];

export default class VideoAnalysisService {
  #camera;
  #controller;
  #prebufferService;
  #mediaService;

  videoanalysisSession = null;
  killed = false;
  destroyed = false;
  cameraState = true;
  restartTimer = null;
  watchdog = null;
  motionEventTimeout = null;
  forceCloseTimeout = null;

  finishLaunching = false;

  constructor(camera, prebufferService, mediaService, controller) {
    //log.debug('Initializing video analysis', camera.name);

    this.#camera = camera;
    this.#controller = controller;
    this.#prebufferService = prebufferService;
    this.#mediaService = mediaService;

    this.cameraName = camera.name;

    this.#controller?.on('finishLaunching', () => {
      if (camera.videoanalysis?.active) {
        log.debug('Videoanalysis finished launching', this.cameraName);
      }

      this.finishLaunching = true;
    });
  }

  reconfigure(camera) {
    const oldVideoConfig = this.#camera.videoConfig;
    const newVideoConfig = camera.videoConfig;

    this.#camera = camera;
    this.cameraName = camera.name;

    if (!isEqual(oldVideoConfig, newVideoConfig) && this.videoanalysisSession) {
      log.info('Videoanalysis: Video configuration changed! Restarting...', this.cameraName);

      this.restart();
    }
  }

  changeSettings(zones = [], sensitivity, difference, dwellTimer, forceCloseTimer) {
    if (this.videoanalysisSession?.pamDiff) {
      const diff = difference >= 0 && difference <= 255 ? difference : DEFAULT_DIFFERENCE;
      const percent = sensitivity >= 0 && sensitivity <= 100 ? sensitivity : DEFAULT_SENSITIVITY;
      const regions = this.#createRegions(zones, percent, diff);
      const dwellTime = dwellTimer >= 15 && dwellTimer <= 180 ? dwellTimer : DEFAULT_DWELL_TIME;
      const forceCloseTime = forceCloseTimer >= 0 && forceCloseTimer <= 10 ? forceCloseTimer : DEFAULT_DWELL_TIME;

      this.videoanalysisSession.pamDiff.dwellTime = dwellTime;
      this.videoanalysisSession.pamDiff.forceCloseTime = forceCloseTime;
      this.videoanalysisSession.pamDiff.setDifference(diff);
      this.videoanalysisSession.pamDiff.setPercent(100 - percent);
      this.videoanalysisSession.pamDiff.setRegions(regions.length > 0 ? regions : null);
    }
  }

  async start() {
    try {
      this.resetVideoAnalysis();

      const videoConfig = cameraUtils.generateVideoConfig(this.#camera.videoConfig);

      let ffmpegInput = cameraUtils.generateInputSource(videoConfig, videoConfig.subSource).split(/\s+/);
      ffmpegInput = cameraUtils.checkDeprecatedFFmpegArguments(this.#mediaService.codecs.ffmpegVersion, ffmpegInput);

      let withPrebuffer = false;

      if (this.#camera.prebuffering && videoConfig.subSource === videoConfig.source) {
        try {
          ffmpegInput = withPrebuffer = await this.#prebufferService.getVideo();
        } catch {
          // retry
          log.debug(
            'Can not start videoanalysis, prebuffer process not yet started, retrying in 10s..',
            this.cameraName
          );

          this.stop(true);

          await timeout(10000);

          this.start();

          return;
        }
      } else {
        this.cameraState = await this.#pingCamera();

        if (!this.cameraState) {
          log.warn(
            'Can not start video analysis, camera not reachable. Trying again in 60s..',
            this.cameraName,
            'videoanalysis'
          );

          this.stop(true);

          await timeout(60000);

          this.start();

          return;
        }
      }

      this.videoanalysisSession = await this.#startVideoAnalysis(ffmpegInput, videoConfig);

      if (!withPrebuffer) {
        const timer = this.#millisUntilTime('04:00');

        log.debug(
          `Videoanalysis scheduled for restart at 4AM: ${Math.round(timer / 1000 / 60)} minutes`,
          this.cameraName
        );

        this.restartTimer = setTimeout(() => {
          log.info('Sheduled restart of videoanalysis is executed...', this.cameraName);
          this.restart();
        }, timer);
      }
    } catch (error) {
      if (error) {
        log.info('An error occured during starting videoanalysis!', this.cameraName, 'videoanalysis');
        log.error(error, this.cameraName, 'videoanalysis');
      }
    }
  }

  resetVideoAnalysis() {
    this.stop(true);

    this.videoanalysisSession = null;
    this.killed = false;
    this.cameraState = true;
    this.restartTimer = null;
    this.watchdog = null;
    this.motionEventTimeout = null;
    this.forceCloseTimeout = null;
  }

  destroy() {
    this.destroyed = true;
    this.resetVideoAnalysis();
  }

  stop(killed) {
    if (this.destroyed) {
      return;
    }

    if (this.videoanalysisSession) {
      if (killed) {
        this.killed = true;
      }

      if (this.watchdog) {
        clearTimeout(this.watchdog);
      }

      if (this.motionEventTimeout || this.forceCloseTimeout) {
        this.#triggerMotion(false, {
          time: new Date(),
          event: 'killed',
        });
      }

      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }

      this.videoanalysisSession.cp?.kill('SIGKILL');
      this.videoanalysisSession = null;
    }
  }

  async restart() {
    log.info('Restart videoanalysis session..', this.cameraName);

    this.stop(true);
    await timeout(14000);
    await this.start();
  }

  async #startVideoAnalysis(input, videoConfig) {
    if (this.videoanalysisSession) {
      return this.videoanalysisSession;
    }

    let isActive = true;

    log.debug('Start videoanalysis...', this.cameraName);

    const videoArguments = ['-an', '-vcodec', 'pam'];

    if (!this.#camera.prebuffering && videoConfig.mapvideo) {
      videoArguments.unshift('-map', videoConfig.mapvideo);
    }

    const ffmpegArguments = [
      '-hide_banner',
      '-loglevel',
      'error',
      //'-hwaccel',
      //'auto',
      ...input,
      ...videoArguments,
      '-pix_fmt',
      FFMPEG_MODE,
      '-f',
      'image2pipe',
      '-vf',
      `fps=${FFMPEG_FPS},scale=${FFMPEG_RESOLUTION}`,
      'pipe:1',
    ];

    log.debug(
      `Videoanalysis command: ${ConfigService.ui.options.videoProcessor} ${ffmpegArguments.join(' ')}`,
      this.cameraName
    );

    let errors = [];

    const settings = await Database.interfaceDB.chain
      .get('settings')
      .get('cameras')
      .find({ name: this.cameraName })
      .cloneDeep()
      .value();

    const zones = settings?.videoanalysis?.regions || [];
    const difference = settings?.videoanalysis?.difference || DEFAULT_DIFFERENCE;
    const sensitivity = settings?.videoanalysis?.sensitivity || DEFAULT_SENSITIVITY;
    const regions = this.#createRegions(zones, sensitivity, difference);
    const dwellTime = settings?.videoanalysis?.dwellTimer || DEFAULT_DWELL_TIME;
    const forceCloseTime = settings?.videoanalysis?.forceCloseTimer || DEFAULT_FORCECLOSE_TIME;

    const p2p = new P2P();
    const pamDiff = new PamDiff({
      difference: difference,
      percent: 100 - sensitivity,
      regions: regions.length > 0 ? regions : null,
      response: 'percent',
    });

    pamDiff.dwellTime = dwellTime;
    pamDiff.forceCloseTime = forceCloseTime;

    const restartWatchdog = () => {
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        log.error('Videoanalysis timed out... killing ffmpeg session', this.cameraName, 'videoanalysis');
        cp?.kill('SIGKILL');

        isActive = false;
      }, 15000);
    };

    p2p.on('pam', () => {
      restartWatchdog();

      Socket.io.emit('videoanalysisStatus', {
        camera: this.cameraName,
        status: 'active',
      });

      isActive = true;
    });

    // eslint-disable-next-line no-unused-vars
    pamDiff.on('diff', async (data) => {
      if (!this.finishLaunching) {
        return;
      }

      const event = data.trigger.map((data) => {
        return {
          zone: data.name,
          percent: data.percent,
          sensitivity: Math.round(100 - data.percent) + 1,
          dwell: pamDiff.dwellTime,
          forceClose: pamDiff.forceCloseTime,
        };
      });

      if (!this.motionEventTimeout) {
        this.#triggerMotion(true, event);

        // forceClose after 3min
        if (pamDiff.forceCloseTime > 0) {
          this.forceCloseTimeout = setTimeout(() => {
            this.#triggerMotion(false, {
              time: new Date(),
              event: `forceClose (${pamDiff.forceCloseTime}m)`,
            });
          }, pamDiff.forceCloseTime * 60 * 1000);
        }
      }

      if (this.motionEventTimeout) {
        log.debug(`New motion detected, resetting motion in ${pamDiff.dwellTime}s..`, this.cameraName);
        log.debug(`Motion data: ${JSON.stringify(event)}}`, this.cameraName);

        clearTimeout(this.motionEventTimeout);
        this.motionEventTimeout = null;
      }

      this.motionEventTimeout = setTimeout(async () => {
        this.#triggerMotion(false, {
          time: new Date(),
          event: `dwellTime (${pamDiff.dwellTime}s)`,
        });
      }, pamDiff.dwellTime * 1000);
    });

    const cp = spawn(ConfigService.ui.options.videoProcessor, ffmpegArguments, {
      env: process.env,
    });

    cp.stderr.on('data', (data) => {
      errors = errors.slice(-5);
      errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, ' '));
    });

    cp.on('exit', (code, signal) => {
      isActive = false;

      if (code === 1 || (!this.killed && errors.length > 0)) {
        errors.unshift(`FFmpeg videoanalysis process exited with error! (${signal})`);
        log.error(errors.join(' - '), this.cameraName, 'videoanalysis');
      } else {
        log.debug('FFmpeg videoanalysis process exited (expected)', this.cameraName);
      }
    });

    cp.on('close', () => {
      isActive = false;

      log.debug('Videoanalysis process closed', this.cameraName);

      Socket.io.emit('videoanalysisStatus', {
        camera: this.cameraName,
        status: 'inactive',
      });

      if (!this.killed) {
        if (errors.length > 0) {
          log.error(errors.join(' - '), this.cameraName, 'videoanalysis');
        }

        this.restart();
      }
    });

    cp.stdout.pipe(p2p).pipe(pamDiff);

    restartWatchdog();

    return {
      isActive() {
        return isActive;
      },
      cp,
      pamDiff,
      p2p,
    };
  }

  async #triggerMotion(state, data) {
    log.info(
      `New message: Data: ${JSON.stringify(data)} - Motion: ${state ? 'detected' : 'resetted'} - Camera: ${
        this.cameraName
      }`,
      'VIDEOANALYSIS'
    );

    if (!state) {
      if (this.forceCloseTimeout) {
        clearTimeout(this.forceCloseTimeout);
        this.forceCloseTimeout = null;
      }

      if (this.motionEventTimeout) {
        clearTimeout(this.motionEventTimeout);
        this.motionEventTimeout = null;
      }
    }

    await MotionController.handleMotion('motion', this.cameraName, state, 'videoanalysis');
  }

  #millisUntilTime(end = '04:00') {
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

  #createRegions(zones = [], sensitivity, difference) {
    const dif = difference >= 0 && difference <= 255 ? difference : DEFAULT_DIFFERENCE;
    const sens = sensitivity >= 0 && sensitivity <= 100 ? sensitivity : DEFAULT_SENSITIVITY;
    const percent = 100 - sens;

    if (!zones?.length) {
      zones = DEFAULT_ZONE;
    }

    const regions = zones
      ?.map((zone, index) => {
        if (zone.coords?.length > 2) {
          return {
            name: `region${index}`,
            difference: dif,
            percent: percent,
            polygon: zone.coords
              ?.map((coord) => {
                let x = coord[0] < 0 ? 0 : coord[0] > 100 ? 100 : coord[0];
                let y = coord[1] < 0 ? 0 : coord[1] > 100 ? 100 : coord[1];
                if (isUINT(x) && isUINT(y)) {
                  //x: 0 - 100 %   => 0 - 640 px
                  //y: 0 - 100 %   => 0 - 360 px
                  return {
                    x: Math.round((640 / 100) * x),
                    y: Math.round((360 / 100) * y),
                  };
                }
              })
              .filter(Boolean),
          };
        }
      })
      .filter((zone) => zone?.polygon?.length > 2);

    log.debug(
      `Videoanalysis: Difference: ${dif} - Sensitivity: ${sens} - Zones: ${JSON.stringify(regions)}`,
      this.cameraName
    );

    return regions;
  }
}
