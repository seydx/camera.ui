'use-strict';

const _ = require('lodash');
const moment = require('moment');
const P2P = require('pipe2pam');
const PamDiff = require('pam-diff');
const { spawn } = require('child_process');

const cameraUtils = require('../utils/camera.utils');
const { Ping } = require('../../../common/ping');

const { Database } = require('../../../api/database');

const { LoggerService } = require('../../../services/logger/logger.service');
const { ConfigService } = require('../../../services/config/config.service');

const { MotionController } = require('../../motion/motion.controller');

const { log } = LoggerService;

const isUINT = (value) => Number.isInteger(value) && value >= 0;

const FFMPEG_MODE = 'rgb24'; // gray, rgba, rgb24
const FFMPEG_RESOLUTION = '640:360';
const FFMPEG_FPS = '2';

const DWELL_TIME = 60 * 1000;

const DEFAULT_DIFFERENCE = 5; // 1 - 255
const DEFAULT_SENSITIVITY = 75; // 0 - 100
const DEFAULT_ZONE = {
  finished: true,
  coords: [
    [0, 100],
    [0, 0],
    [100, 0],
    [100, 100],
  ],
};

class VideoAnalysisService {
  #camera;
  #controller;
  #socket;
  #prebufferService;

  videoanalysisSession = null;
  killed = false;
  cameraState = true;
  restartTimer = null;
  watchdog = null;
  motionEventTimeout = null;
  forceCloseTimeout = null;

  finishLaunching = false;

  constructor(camera, prebufferService, controller, socket) {
    //log.debug('Initializing video analysis', camera.name);

    this.#camera = camera;
    this.#controller = controller;
    this.#socket = socket;
    this.#prebufferService = prebufferService;

    this.cameraName = camera.name;

    this.#controller.on('finishLaunching', () => {
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

    if (!_.isEqual(oldVideoConfig, newVideoConfig) && this.videoanalysisSession) {
      log.info('Videoanalysis: Video configuration changed! Restarting...', this.cameraName);

      this.restart();
    }
  }

  changeZone(zones = [], sensitivity, difference) {
    if (this.videoanalysisSession?.pamDiff) {
      //this.videoanalysisSession.pamDiff.resetCache();
      //this.videoanalysisSession.p2p.resetCache();

      const diff = difference >= 0 && difference <= 255 ? difference : DEFAULT_DIFFERENCE;
      const percent = sensitivity >= 0 && sensitivity <= 100 ? sensitivity : DEFAULT_SENSITIVITY;
      const regions = this.#createRegions(zones, percent, diff);

      this.videoanalysisSession.pamDiff.setDifference(diff);
      this.videoanalysisSession.pamDiff.setPercent(100 - percent);
      this.videoanalysisSession.pamDiff.setRegions(regions.length > 0 ? regions : null);
    }
  }

  async start() {
    try {
      this.resetVideoAnalysis();

      this.cameraState = await this.#pingCamera();

      if (!this.cameraState) {
        log.warn(
          'Can not start video analysis, camera not reachable. Trying again in 60s..',
          this.cameraName,
          'videoanalysis'
        );

        this.stop(true);
        setTimeout(() => this.start(), 60000);

        return;
      }

      this.videoanalysisSession = await this.#startVideoAnalysis();

      const timer = this.#millisUntilTime('04:00');

      log.info(`Videoanalysis scheduled for restart at 4AM: ${Math.round(timer / 1000 / 60)} minutes`, this.cameraName);

      this.restartTimer = setTimeout(() => {
        log.info('Sheduled restart of videoanalysis is executed...', this.cameraName);
        this.restart();
      }, timer);
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

  stop(killed) {
    if (this.videoanalysisSession) {
      if (killed) {
        this.killed = true;
      }

      if (this.watchdog) {
        clearTimeout(this.watchdog);
      }

      if (this.motionEventTimeout || this.forceCloseTimeout) {
        this.#triggerMotion(false, 'killed');
      }

      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }

      this.videoanalysisSession.cp?.kill('SIGKILL');
      //this.videoanalysisSession.pamDiff?.resetCache();
      this.videoanalysisSession = null;
    }
  }

  restart() {
    log.info('Restart videoanalysis session..', this.cameraName);
    this.stop(true);
    setTimeout(() => this.start(), 10000);
  }

  async #startVideoAnalysis() {
    if (this.videoanalysisSession) {
      return this.videoanalysisSession;
    }

    let isActive = true;

    log.debug('Start videoanalysis...', this.cameraName);

    const videoConfig = cameraUtils.generateVideoConfig(this.#camera.videoConfig);
    let input = cameraUtils.generateInputSource(videoConfig, videoConfig.subSource).split(/\s+/);
    let prebufferInput = false;
    let invalidSubstream = videoConfig.subSource === videoConfig.source;

    if (this.#camera.prebuffering && invalidSubstream) {
      try {
        input = prebufferInput = await this.#prebufferService.getVideo();
      } catch {
        // ignore
      }
    }

    const videoArguments = ['-an', '-vcodec', 'pam'];

    if (!prebufferInput && videoConfig.mapvideo) {
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

    const settings = await Database.interfaceDB.get('settings').get('cameras').find({ name: this.cameraName }).value();

    const zones = settings?.videoanalysis?.regions || [];
    const difference = settings?.videoanalysis?.difference || DEFAULT_DIFFERENCE;
    const sensitivity = settings?.videoanalysis?.sensitivity || DEFAULT_SENSITIVITY;
    const regions = this.#createRegions(zones, sensitivity, difference);

    const p2p = new P2P();
    const pamDiff = new PamDiff({
      difference: difference,
      percent: 100 - sensitivity,
      regions: regions.length > 0 ? regions : null,
      response: 'percent',
      //response: 'bounds',
      //draw: true,
    });

    const restartWatchdog = () => {
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        log.error('Watchdog for videoanalysis timed out... killing ffmpeg session', this.cameraName, 'videoanalysis');
        cp?.kill('SIGKILL');

        isActive = false;
      }, 15000);
    };

    p2p.on('pam', () => {
      restartWatchdog();

      this.#socket.emit('videoanalysisStatus', {
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

      if (!this.motionEventTimeout) {
        this.#triggerMotion(true, 'pixelDifference');

        // forceClose after 3min
        this.forceCloseTimeout = setTimeout(() => {
          this.#triggerMotion(false, 'forceClose');
        }, 3 * 60 * 1000);
      }

      if (this.motionEventTimeout) {
        log.debug('Dwell time resetted because new motion detected, resetting motion in 60s..', this.cameraName);

        clearTimeout(this.motionEventTimeout);
        this.motionEventTimeout = null;
      }

      this.motionEventTimeout = setTimeout(async () => {
        this.#triggerMotion(false, 'dwellTime');
      }, DWELL_TIME);
    });

    const cp = spawn(ConfigService.ui.options.videoProcessor, ffmpegArguments, {
      env: process.env,
    });

    cp.stderr.on('data', (data) => {
      errors = errors.slice(-5);
      errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, ''));
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

      this.#socket.emit('videoanalysisStatus', {
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

  async #triggerMotion(state, reason) {
    log.debug(
      `New message: Motion: ${state ? 'detected' : 'resetted'} - Reason: ${reason} - Camera: ${this.cameraName}`,
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
              .filter((coord) => coord),
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

exports.VideoAnalysisService = VideoAnalysisService;
