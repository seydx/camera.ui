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

const storeFrameFromVideoBuffer = function (camera, fileBuffer, outputPath) {
  return new Promise((resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;

    const ffmpegArguments = [
      '-hide_banner',
      '-loglevel',
      'quiet',
      '-an',
      '-sn',
      '-dn',
      '-y',
      '-re',
      '-i',
      '-',
      '-s',
      `${camera.videoConfig.maxWidth}x${camera.videoConfig.maxHeight}`,
      '-f',
      'image2',
      '-update',
      '1',
    ];

    if (camera.videoConfig.videoFilter) {
      ffmpegArguments.push('-filter:v', camera.videoConfig.videoFilter);
    }

    ffmpegArguments.push(outputPath);

    log.debug(`Snapshot command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, camera.name);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('close', () => {
      log.debug(`Snapshot stored to: ${outputPath}`, camera.name);
      resolve();
    });

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg snapshot process exited with error! (${signal})`, camera.name);
      } else {
        log.debug('FFmpeg snapshot process exited (expected)', camera.name);
      }
    });

    ffmpeg.stdin.write(fileBuffer);
    ffmpeg.stdin.destroy();
  });
};

const startFFMPegFragmetedMP4Session = async function (camera, ffmpegInput, audioOutArguments, videoOutArguments) {
  log.debug('Start recording...', camera.name);

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

    const serverPort = await cameraUtils.listenServer(server);
    const ffmpegArguments = [];

    ffmpegArguments.push(
      //'-loglevel',
      //'error',
      '-hide_banner',
      ...ffmpegInput,
      '-f',
      'mp4',
      ...videoOutArguments,
      ...audioOutArguments,
      '-fflags',
      '+genpts',
      '-reset_timestamps',
      '1',
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      'tcp://127.0.0.1:' + serverPort
    );

    log.debug(`Recording command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, camera.name);

    const cp = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    cp.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg recording process exited with error! (${signal})`, camera.name);
      } else {
        log.debug('FFmpeg recording process exited (expected)', camera.name);
      }
    });

    if (camera.videoConfig.debug) {
      cp.stdout.on('data', (data) => log.debug(data.toString(), camera.name));
      cp.stderr.on('data', (data) => log.debug(data.toString(), camera.name));
    }

    //cp.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), camera.name));
  });
};

exports.storeBuffer = async function (
  camera,
  fileBuffer,
  recordingPath,
  fileName,
  label,
  isPlaceholder,
  externRecording
) {
  let outputPath = `${recordingPath}/${fileName}${isPlaceholder ? '@2' : ''}.jpeg`;

  // eslint-disable-next-line unicorn/prefer-ternary
  if (externRecording) {
    await storeFrameFromVideoBuffer(camera, fileBuffer, outputPath);
  } else {
    await fs.outputFile(outputPath, fileBuffer, { encoding: 'base64' });
  }

  replaceJpegWithExifJPEG(camera.name, outputPath, label);
};

exports.getAndStoreSnapshot = function (camera, recordingPath, fileName, label, isPlaceholder, storeSnapshot) {
  return new Promise((resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;

    const ffmpegInput = [...camera.videoConfig.source.split(' ')];

    const destination = storeSnapshot ? `${recordingPath}/${fileName}${isPlaceholder ? '@2' : ''}.jpeg` : '-';

    const ffmpegArguments = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      ...ffmpegInput,
      '-s',
      `${camera.videoConfig.maxWidth}x${camera.videoConfig.maxHeight}`,
      '-frames:v',
      '2',
      '-r',
      '1',
      '-update',
      '1',
      '-f',
      'image2',
    ];

    if (camera.videoConfig.videoFilter) {
      ffmpegArguments.push('-filter:v', camera.videoConfig.videoFilter);
    }

    ffmpegArguments.push(destination);

    log.debug(`Snapshot requested, command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, camera.name);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    ffmpeg.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), camera.name));

    let imageBuffer = Buffer.alloc(0);

    ffmpeg.stdout.on('data', (data) => {
      imageBuffer = Buffer.concat([imageBuffer, data]);

      if (storeSnapshot) {
        log.debug(data.toString(), camera.name);
      }
    });

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('close', () => {
      if (!imageBuffer || (imageBuffer && imageBuffer.length <= 0)) {
        return reject(new Error('Image Buffer is empty!'));
      }

      if (storeSnapshot) {
        replaceJpegWithExifJPEG(camera.name, destination, label);
      }

      resolve(imageBuffer);
    });

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg snapshot process exited with error! (${signal})`, camera.name);
      } else {
        log.debug('FFmpeg snapshot process exited (expected)', camera.name);
      }
    });
  });
};

// eslint-disable-next-line no-unused-vars
exports.storeVideo = function (camera, recordingPath, fileName, recordingTimer) {
  return new Promise((resolve, reject) => {
    const videoProcessor = ConfigService.ui.options.videoProcessor;

    const ffmpegInput = [...camera.videoConfig.source.split(' ')];

    let videoName = `${recordingPath}/${fileName}.mp4`;

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
      '-c:v',
      'copy',
      '-s',
      `${camera.videoConfig.maxWidth}x${camera.videoConfig.maxHeight}`,
      '-movflags',
      '+faststart',
      '-crf',
      '23',
    ];

    if (camera.videoConfig.videoFilter) {
      ffmpegArguments.push('-filter:v', camera.videoConfig.videoFilter);
    }

    ffmpegArguments.push(videoName);

    log.debug(`Video requested, command: ${videoProcessor} ${ffmpegArguments.join(' ')}`, camera.name);

    const ffmpeg = spawn(videoProcessor, ffmpegArguments, { env: process.env });

    ffmpeg.stderr.on('data', (data) => log.error(data.toString().replace(/(\r\n|\n|\r)/gm, ''), camera.name));

    ffmpeg.on('error', (error) => reject(error));

    ffmpeg.on('close', () => {
      log.debug(`Video stored to: ${videoName}`, camera.name);
      resolve();
    });

    ffmpeg.on('exit', (code, signal) => {
      if (code === 1) {
        log.error(`FFmpeg video process exited with error! (${signal})`, camera.name);
      } else {
        log.debug('FFmpeg video process exited (expected)', camera.name);
      }
    });
  });
};

exports.storeVideoBuffer = function (camera, fileBuffer, recordingPath, fileName) {
  return new Promise((resolve, reject) => {
    let videoName = `${recordingPath}/${fileName}.mp4`;

    log.debug(`Storing video to: ${videoName}`, camera.name);

    const writeStream = fs.createWriteStream(videoName);

    writeStream.write(fileBuffer);
    writeStream.end();

    writeStream.on('finish', () => resolve());
    writeStream.on('error', reject);
  });
};

exports.handleFragmentsRequests = async function* (camera) {
  log.debug('Video fragments requested from interface', camera.name);

  const prebufferLength = 6000;
  const audioArguments = ['-codec:a', 'copy'];
  const videoArguments = ['-codec:v', 'copy'];

  let ffmpegInput = [...camera.videoConfig.source.split(' ')];

  if (camera.prebuffering) {
    const controller = CameraController.cameras.get(camera.name);

    if (controller && controller.prebuffer) {
      try {
        log.debug('Setting prebuffer stream as input', camera.name);

        const input = await controller.prebuffer.getVideo(prebufferLength);

        ffmpegInput = [];
        ffmpegInput.push(...input);
      } catch (error) {
        log.warn(`Can not access prebuffered video, skipping: ${error}`, camera.name);
      }
    }
  }

  const session = await startFFMPegFragmetedMP4Session(camera, ffmpegInput, audioArguments, videoArguments);

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

      /*if (camera.videoConfig.debug) {
        log.debug(`mp4 box type ${type} and lenght: ${length}`, camera.name);
      }*/
    }
  } catch (error) {
    log.debug(`Recording completed. (${error})`, camera.name);
  } finally {
    socket.destroy();
    cp.kill();
  }
};
