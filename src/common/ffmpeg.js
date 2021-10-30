'use-strict';

const { createServer } = require('net');
const fs = require('fs-extra');
const piexif = require('piexifjs');
const { spawn } = require('child_process');

const cameraUtils = require('../controller/camera/utils/camera.utils');

const { ConfigService } = require('../services/config/config.service');
const { LoggerService } = require('../services/logger/logger.service');

const { CameraController } = require('../controller/camera/camera.controller');

const { log } = LoggerService;

const replaceJpegWithExifJPEG = function (cameraName, filePath, label) {
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

const storeFrameFromVideoBuffer = function (cameraName, outputPath, videoBuffer, videoConfig) {
  return new Promise((resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;

    const ffmpegArguments = [
      '-loglevel',
      'error',
      '-hide_banner',
      '-an',
      '-sn',
      '-dn',
      '-re',
      '-y',
      '-i',
      '-',
      '-s',
      `${videoConfig.maxWidth}x${videoConfig.maxHeight}`,
      '-f',
      'image2',
      '-update',
      '1',
    ];

    if (videoConfig.videoFilter) {
      ffmpegArguments.push('-filter:v', videoConfig.videoFilter);
    }

    ffmpegArguments.push(outputPath);

    log.debug(`Snapshot command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, cameraName);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    ffmpeg.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), cameraName));

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('close', () => {
      log.debug(`Snapshot stored to: ${outputPath}`, cameraName);
      resolve();
    });

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg snapshot process exited with error! (${signal})`, cameraName);
      } else {
        log.debug('FFmpeg snapshot process exit (expected)', cameraName);
      }
    });

    ffmpeg.stdin.write(videoBuffer);
    ffmpeg.stdin.destroy();
  });
};

const startFFMPegFragmetedMP4Session = async function (
  cameraName,
  ffmpegInput,
  audioOutputArguments,
  videoOutputArguments,
  debug
) {
  log.debug('Start recording...', cameraName);

  const videoProcessor = ConfigService.ui.options.videoProcessor;

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve) => {
    const server = createServer((socket) => {
      server.close();

      async function* generator() {
        while (true) {
          const header = await cameraUtils.readLength(socket, 8);
          const length = header.readInt32BE(0) - 8;
          const type = header.slice(4).toString();
          const data = await cameraUtils.readLength(socket, length);

          yield {
            header,
            length,
            type,
            data,
          };
        }
      }

      resolve({
        socket,
        cp,
        generator: generator(),
      });
    });

    const serverPort = await cameraUtils.listenServer(cameraName, server);
    const ffmpegArguments = [];

    ffmpegArguments.push(
      '-loglevel',
      'error',
      '-hide_banner',
      ...ffmpegInput,
      '-f',
      'mp4',
      ...videoOutputArguments,
      //...audioOutputArguments,
      '-fflags',
      '+genpts',
      '-reset_timestamps',
      '1',
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      'tcp://127.0.0.1:' + serverPort
    );

    log.debug(`Recording command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, cameraName);

    const cp = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    cp.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg recording process exited with error! (${signal})`, cameraName);
      } else {
        log.debug('FFmpeg recording process exit (expected)', cameraName);
      }
    });

    if (debug) {
      cp.stdout.on('data', (data) => log.debug(data.toString(), cameraName));
      //cp.stderr.on('data', (data) => log.debug(data.toString(), cameraName));
    }

    cp.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), cameraName));
  });
};

exports.storeBuffer = async function (
  cameraName,
  videoConfig,
  imageBuffer,
  name,
  isPlaceholder,
  recPath,
  label,
  customRecording
) {
  let outputPath = recPath + '/' + name + (isPlaceholder ? '@2' : '') + '.jpeg';

  await (customRecording
    ? storeFrameFromVideoBuffer(cameraName, outputPath, imageBuffer, videoConfig)
    : fs.outputFile(outputPath, imageBuffer, { encoding: 'base64' }));

  replaceJpegWithExifJPEG(cameraName, outputPath, label);
};

exports.getAndStoreSnapshot = function (cameraName, videoConfig, name, additional, recPath, label, store) {
  return new Promise((resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;

    const ffmpegArguments = videoConfig.source.replace('-i', '-y -i').split(' ');
    const destination = store ? recPath + '/' + name + (additional ? '@2' : '') + '.jpeg' : '-';

    ffmpegArguments.push(
      '-loglevel',
      'error',
      '-hide_banner',
      '-s',
      `${videoConfig.maxWidth}x${videoConfig.maxHeight}`,
      '-frames:v',
      '2',
      '-r',
      '1',
      '-update',
      '1',
      '-f',
      'image2'
    );

    if (videoConfig.videoFilter) {
      ffmpegArguments.push('-filter:v', videoConfig.videoFilter);
    }

    ffmpegArguments.push(destination);

    log.debug(`Snapshot requested, command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, cameraName);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    ffmpeg.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), cameraName));

    let imageBuffer = Buffer.alloc(0);

    ffmpeg.stdout.on('data', (data) => {
      imageBuffer = Buffer.concat([imageBuffer, data]);

      if (store) {
        log.debug(data.toString(), cameraName);
      }
    });

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('close', () => {
      if (!imageBuffer || (imageBuffer && imageBuffer.length <= 0)) {
        return reject(new Error('Image Buffer is empty!'));
      }

      if (store) {
        replaceJpegWithExifJPEG(cameraName, destination, label);
      }

      resolve(imageBuffer);
    });

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg snapshot process exited with error! (${signal})`, cameraName);
      } else {
        log.debug('FFmpeg snapshot process exit (expected)', cameraName);
      }
    });
  });
};

// eslint-disable-next-line no-unused-vars
exports.storeVideo = function (cameraName, videoConfig, name, recPath, recTimer, label) {
  return new Promise((resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;

    let ffmpegArguments = videoConfig.source.replace('-i', '-nostdin -y -i').split(' ');
    let videoName = recPath + '/' + name + '.mp4';

    ffmpegArguments.push(
      '-loglevel error',
      '-hide_banner',
      `-t ${recTimer}`,
      '-strict experimental',
      '-threads 0',
      '-c:v copy',
      `-s ${videoConfig.maxWidth}x${videoConfig.maxHeight}`,
      '-movflags +faststart',
      '-crf 23 ',
      videoName
    );

    if (videoConfig.videoFilter) {
      ffmpegArguments.push('-filter:v', videoConfig.videoFilter);
    }

    ffmpegArguments.push(videoName);

    log.debug(`Video requested, command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, cameraName);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    ffmpeg.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), cameraName));

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('close', () => {
      log.debug(`Video stored to: ${videoName}`, cameraName);
      resolve();
    });

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg video process exited with error! (${signal})`, cameraName);
      } else {
        log.debug('FFmpeg video process exit (expected)', cameraName);
      }
    });
  });
};

exports.storeVideoBuffer = function (cameraName, name, recPath, buffer) {
  return new Promise((resolve, reject) => {
    let videoName = recPath + '/' + name + '.mp4';

    log.debug(`Storing video to: ${videoName}`, cameraName);

    const writeStream = fs.createWriteStream(videoName);

    writeStream.write(buffer);
    writeStream.end();

    writeStream.on('finish', () => resolve());
    writeStream.on('error', reject);
  });
};

exports.handleFragmentsRequests = async function* (cameraName, videoConfig, prebuffering) {
  log.debug('Video fragments requested from interface', cameraName);

  const prebufferLength = 4000;
  const audioArguments = ['-codec:a', 'copy'];
  const videoArguments = ['-codec:v', 'copy'];

  let ffmpegInput = [...videoConfig.source.split(' ')];

  if (prebuffering) {
    const controller = CameraController.cameras.get(cameraName);

    if (controller && controller.prebuffer) {
      try {
        log.debug('Setting prebuffer stream as input', cameraName);

        const input = await controller.prebuffer.getVideo(prebufferLength);

        ffmpegInput = [];
        ffmpegInput.push(...input);
      } catch (error) {
        log.warn(`Can not access prebuffered video, skipping: ${error}`, cameraName);
      }
    }
  }

  const session = await startFFMPegFragmetedMP4Session(
    cameraName,
    ffmpegInput,
    audioArguments,
    videoArguments,
    videoConfig.debug
  );

  log.debug('Recording started', cameraName);

  const { socket, cp, generator } = session;
  let pending = [];

  try {
    for await (const box of generator) {
      const { header, type, length, data } = box;

      pending.push(header, data);

      if (type === 'moov' || type === 'mdat') {
        const buffer = pending;
        pending = [];

        yield buffer;
      }

      if (videoConfig.debug) {
        log.debug(`mp4 box type ${type} and lenght: ${length}`, cameraName);
      }
    }
  } catch (error) {
    log.debug(`Recording completed. (${error})`, cameraName);
  } finally {
    socket.destroy();
    cp.kill();
  }
};
