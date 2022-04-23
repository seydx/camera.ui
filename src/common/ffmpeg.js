'use-strict';

import fs from 'fs-extra';
import piexif from 'piexifjs';
import { spawn } from 'child_process';

import * as cameraUtils from '../controller/camera/utils/camera.utils.js';

import ConfigService from '../services/config/config.service.js';
import LoggerService from '../services/logger/logger.service.js';

import CameraController from '../controller/camera/camera.controller.js';

const { log } = LoggerService;

const snapshotCache = {};

const replaceJpegWithExifJPEG = (cameraName, filePath, label) => {
  let jpeg;

  try {
    jpeg = fs.readFileSync(filePath);
  } catch {
    log.debug(`Can not read file ${filePath} to create EXIF information, skipping..`);
  }

  if (!jpeg) {
    return;
  }

  const zeroth = {};
  const data = jpeg.toString('binary');

  zeroth[piexif.ImageIFD.XPTitle] = [...Buffer.from(cameraName, 'ucs2')];
  zeroth[piexif.ImageIFD.XPComment] = [...Buffer.from(label, 'ucs2')];
  zeroth[piexif.ImageIFD.XPAuthor] = [...Buffer.from('camera.ui', 'ucs2')];

  const exifObject = { '0th': zeroth, Exif: {}, GPS: {} };
  const exifbytes = piexif.dump(exifObject);

  var newData = piexif.insert(exifbytes, data);
  var newJpeg = Buffer.from(newData, 'binary');

  fs.writeFileSync(filePath, newJpeg);
};

const storeFrameFromVideoBuffer = (camera, fileBuffer, outputPath) => {
  return new Promise((resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;
    const videoConfig = cameraUtils.generateVideoConfig(camera.videoConfig);

    const videoWidth = videoConfig.maxWidth;
    const videoHeight = videoConfig.maxHeight;

    const ffmpegArguments = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-an',
      '-sn',
      '-dn',
      '-y',
      '-re',
      '-i',
      '-',
      '-s',
      `${videoWidth}x${videoHeight}`,
      '-f',
      'image2',
      '-update',
      '1',
    ];

    ffmpegArguments.push(outputPath);

    log.debug(`Snapshot command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, camera.name);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    let errors = [];

    ffmpeg.stderr.on('data', (data) => {
      errors = errors.slice(-5);
      errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, ' '));
    });

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        errors.unshift(`FFmpeg snapshot process exited with error! (${signal})`);
        reject(new Error(errors.join(' - ')));
      } else {
        log.debug('FFmpeg snapshot process exited (expected)', camera.name, 'ffmpeg');
        log.debug(`Snapshot stored to: ${outputPath}`, camera.name);

        resolve();
      }

      return;
    });

    ffmpeg.stdin.write(fileBuffer);
    ffmpeg.stdin.destroy();
  });
};

export const storeBuffer = async (
  camera,
  fileBuffer,
  recordingPath,
  fileName,
  label,
  isPlaceholder,
  externRecording
) => {
  let outputPath = `${recordingPath}/${fileName}${isPlaceholder ? '@2' : ''}.jpeg`;

  // eslint-disable-next-line unicorn/prefer-ternary
  if (externRecording) {
    await storeFrameFromVideoBuffer(camera, fileBuffer, outputPath);
  } else {
    await fs.outputFile(outputPath, fileBuffer, { encoding: 'base64' });
  }

  replaceJpegWithExifJPEG(camera.name, outputPath, label);
};

export const getAndStoreSnapshot = (
  camera,
  fromSubSource,
  recordingPath,
  fileName,
  label,
  isPlaceholder,
  storeSnapshot
) => {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    if (!storeSnapshot && snapshotCache[camera.name]) {
      let store = fromSubSource ? snapshotCache[camera.name].sub : snapshotCache[camera.name].main;

      if (store) {
        const now = Date.now();
        if ((now - store.time) / 1000 <= 10) {
          log.debug('Snapshot requested (cache)', camera.name);
          return resolve(store.buffer);
        }
      }
    }

    const videoProcessor = ConfigService.ui.options.videoProcessor;
    const videoConfig = cameraUtils.generateVideoConfig(camera.videoConfig);
    const videoWidth = videoConfig.maxWidth;
    const videoHeight = videoConfig.maxHeight;
    const destination = storeSnapshot ? `${recordingPath}/${fileName}${isPlaceholder ? '@2' : ''}.jpeg` : '-';
    const controller = CameraController.cameras.get(camera.name);

    let ffmpegInput = [
      ...cameraUtils.generateInputSource(videoConfig, fromSubSource ? videoConfig.subSource : false).split(/\s+/),
    ];

    ffmpegInput = cameraUtils.checkDeprecatedFFmpegArguments(controller?.media?.codecs?.ffmpegVersion, ffmpegInput);

    if (!fromSubSource && camera.prebuffering && controller?.prebuffer) {
      try {
        ffmpegInput = await controller.prebuffer.getVideo();
      } catch {
        // ignore
      }
    }

    const ffmpegArguments = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      ...ffmpegInput,
      '-s',
      `${videoWidth}x${videoHeight}`,
      '-frames:v',
      '2',
      '-r',
      '1',
      '-update',
      '1',
      '-f',
      'image2',
    ];

    if (videoConfig.videoFilter) {
      ffmpegArguments.push('-filter:v', videoConfig.videoFilter);
    }

    ffmpegArguments.push(destination);

    log.debug(`Snapshot requested, command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, camera.name);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    let errors = [];

    ffmpeg.stderr.on('data', (data) => {
      errors = errors.slice(-5);
      errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, ' '));
    });

    let imageBuffer = Buffer.alloc(0);

    ffmpeg.stdout.on('data', (data) => {
      imageBuffer = Buffer.concat([imageBuffer, data]);

      if (storeSnapshot) {
        log.debug(data.toString(), camera.name);
      }
    });

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        errors.unshift(`FFmpeg snapshot process exited with error! (${signal})`);
        reject(new Error(errors.join(' - ')));
      } else if (!imageBuffer || (imageBuffer && imageBuffer.length <= 0)) {
        errors.unshift('Image Buffer is empty!');
        reject(new Error(errors.join(' - ')));
      } else {
        log.debug('FFmpeg snapshot process exited (expected)', camera.name, 'ffmpeg');

        if (storeSnapshot) {
          replaceJpegWithExifJPEG(camera.name, destination, label);
        }

        snapshotCache[camera.name] = {
          time: Date.now(),
          buffer: imageBuffer,
        };

        resolve(imageBuffer);
      }
    });
  });
};

export const storeSnapshotFromVideo = async (camera, recordingPath, fileName, label) => {
  return new Promise((resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;
    const videoName = `${recordingPath}/${fileName}.mp4`;
    const destination = `${recordingPath}/${fileName}@2.jpeg`;

    const ffmpegArguments = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      '00:00:03.500',
      '-i',
      videoName,
      '-frames:v',
      '1',
    ];

    ffmpegArguments.push(destination);

    log.debug(`Snapshot requested, command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, camera.name);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    let errors = [];

    ffmpeg.stderr.on('data', (data) => {
      errors = errors.slice(-5);
      errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, ' '));
    });

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        errors.unshift(`FFmpeg snapshot process exited with error! (${signal})`);
        reject(new Error(errors.join(' - ')));
      } else {
        log.debug('FFmpeg snapshot process exited (expected)', camera.name, 'ffmpeg');

        replaceJpegWithExifJPEG(camera.name, destination, label);

        resolve();
      }
    });
  });
};

// eslint-disable-next-line no-unused-vars
export const storeVideo = (camera, recordingPath, fileName, recordingTimer) => {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;
    const videoConfig = cameraUtils.generateVideoConfig(camera.videoConfig);
    const videoName = `${recordingPath}/${fileName}.mp4`;
    const videoWidth = videoConfig.maxWidth;
    const videoHeight = videoConfig.maxHeight;
    const vcodec = videoConfig.vcodec;
    const controller = CameraController.cameras.get(camera.name);

    let ffmpegInput = [...cameraUtils.generateInputSource(videoConfig).split(/\s+/)];
    ffmpegInput = cameraUtils.checkDeprecatedFFmpegArguments(controller?.media?.codecs?.ffmpegVersion, ffmpegInput);

    if (camera.prebuffering && controller?.prebuffer) {
      try {
        ffmpegInput = await controller.prebuffer.getVideo();
      } catch {
        // ignore
      }
    }

    const ffmpegArguments = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      ...ffmpegInput,
      '-t',
      recordingTimer.toString(),
      '-strict',
      'experimental',
      '-threads',
      '0',
      '-s',
      `${videoWidth}x${videoHeight}`,
      '-vcodec',
      `${vcodec}`,
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-crf',
      '23',
    ];

    if (videoConfig.mapvideo) {
      ffmpegArguments.push('-map', videoConfig.mapvideo);
    }

    if (videoConfig.videoFilter) {
      ffmpegArguments.push('-filter:v', videoConfig.videoFilter);
    }

    if (videoConfig.mapaudio) {
      ffmpegArguments.push('-map', videoConfig.mapaudio);
    }

    ffmpegArguments.push(videoName);

    log.debug(`Video requested, command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, camera.name);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    let errors = [];

    ffmpeg.stderr.on('data', (data) => {
      errors = errors.slice(-5);
      errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, ' '));
    });

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        errors.unshift(`FFmpeg video process exited with error! (${signal})`);
        reject(new Error(errors.join(' - ')));
      } else {
        log.debug('FFmpeg video process exited (expected)', camera.name, 'ffmpeg');
        log.debug(`Video stored to: ${videoName}`, camera.name);

        resolve();
      }
    });
  });
};

export const storeVideoBuffer = (camera, fileBuffer, recordingPath, fileName) => {
  return new Promise((resolve, reject) => {
    const videoName = `${recordingPath}/${fileName}.mp4`;

    log.debug(`Storing video to: ${videoName}`, camera.name);

    const writeStream = fs.createWriteStream(videoName);

    writeStream.write(fileBuffer);
    writeStream.end();

    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
};

export const handleFragmentsRequests = async function* (camera) {
  log.debug('Video fragments requested from interface', camera.name);

  const videoConfig = cameraUtils.generateVideoConfig(camera.videoConfig);
  const audioArguments = ['-acodec', 'copy'];
  const videoArguments = ['-vcodec', 'copy'];
  const controller = CameraController.cameras.get(camera.name);

  let ffmpegInput = [...cameraUtils.generateInputSource(videoConfig).split(/\s+/)];
  ffmpegInput = cameraUtils.checkDeprecatedFFmpegArguments(controller?.media?.codecs?.ffmpegVersion, ffmpegInput);

  if (camera.prebuffering && controller?.prebuffer) {
    try {
      log.debug('Setting prebuffer stream as input', camera.name);

      const input = await controller.prebuffer.getVideo({
        container: 'mp4',
        prebuffer: camera.prebufferLength,
      });

      ffmpegInput = [];
      ffmpegInput.push(...input);
    } catch (error) {
      log.warn(`Can not access prebuffer stream, skipping: ${error}`, camera.name, 'ffmpeg');
    }
  }

  const session = await cameraUtils.startFFMPegFragmetedMP4Session(
    camera.name,
    videoConfig.debug,
    ConfigService.ui.options.videoProcessor,
    ffmpegInput,
    audioArguments,
    videoArguments
  );

  log.debug('Recording started', camera.name);

  const { socket, cp, generator } = session;
  let pending = [];

  try {
    for await (const box of generator) {
      const { header, type, data } = box;

      pending.push(header, data);

      if (type === 'moov' || type === 'mdat') {
        const fileBuffer = pending;
        pending = [];

        yield fileBuffer;
      }
    }
  } catch {
    log.debug('Recording completed. (UI)', camera.name);
  } finally {
    socket.destroy();
    cp.kill();
  }
};
