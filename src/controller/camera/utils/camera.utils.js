/* eslint-disable unicorn/number-literal-case */
'use-strict';

import compareVersions from 'compare-versions';
import { createServer } from 'net';
import { once } from 'events';
import readline from 'readline';
import { spawn } from 'child_process';

import LoggerService from '../../../services/logger/logger.service.js';

const findSyncFrame = (streamChunks) => {
  return streamChunks;
};

export const ignoredFfmpegError = (line) => {
  const mutedErrors = ['no frame', 'decode_slice_header', 'non-existing PPS 0'];
  return mutedErrors.some((key) => line.includes(key));
};

export const listenServer = async (server) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const port = 10000 + Math.round(Math.random() * 30000);
    server.listen(port);

    try {
      await once(server, 'listening');
      return server.address().port;
    } catch {
      //ignore
    }
  }
};

export const readLength = (socket, length) => {
  if (!socket) {
    throw new Error('FFMPEG tried reading from closed socket!');
  }

  if (!length) {
    return Buffer.alloc(0);
  }

  const value = socket.read(length);
  if (value) {
    return value;
  }

  // eslint-disable-next-line no-unused-vars
  return new Promise((resolve, reject) => {
    const readHandler = () => {
      const value = socket.read(length);

      if (value) {
        cleanup();
        resolve(value);
      }
    };

    const endHandler = () => {
      cleanup();
      reject(new Error(`FFMPEG socket closed during read for ${length} bytes!`));
    };

    const cleanup = () => {
      socket.removeListener('readable', readHandler);
      socket.removeListener('close', endHandler);
    };

    if (!socket) {
      throw new Error('FFMPEG socket is closed now!');
    }

    socket.on('readable', readHandler);
    socket.on('close', endHandler);
  });
};

export const parseFragmentedMP4 = async function* (socket) {
  if (!socket) {
    throw new Error('Unexpected state!');
  }

  while (true) {
    const header = await readLength(socket, 8);
    const length = header.readInt32BE(0) - 8;
    const type = header.slice(4).toString();
    const data = await readLength(socket, length);

    yield {
      header,
      length,
      type,
      data,
    };
  }
};

/**
 *
 * @url https://github.com/koush/scrypted/blob/fcfdadc9849099134e3f6ee6002fa1203bccdc91/common/src/stream-parser.ts#L173
 * (c) koush <https://github.com/koush>
 *
 **/
export const createFragmentedMp4Parser = () => {
  return {
    container: 'mp4',
    outputArguments: '[movflags=frag_keyframe+empty_moov+default_base_moof:f=mp4]',
    async *parse(socket) {
      const parser = parseFragmentedMP4(socket);

      let ftyp;
      let moov;
      let startStream;

      for await (const atom of parser) {
        if (!ftyp) {
          ftyp = atom;
        } else if (!moov) {
          moov = atom;
        }

        yield {
          startStream,
          chunks: [atom.header, atom.data],
          type: atom.type,
        };

        if (ftyp && moov && !startStream) {
          startStream = Buffer.concat([ftyp.header, ftyp.data, moov.header, moov.data]);
        }
      }
    },
    findSyncFrame,
  };
};

/**
 *
 * @url https://github.com/koush/scrypted/blob/fcfdadc9849099134e3f6ee6002fa1203bccdc91/common/src/stream-parser.ts#L44
 * (c) koush <https://github.com/koush>
 *
 **/
export const createLengthParser = (length, verify) => {
  async function* parse(socket) {
    let pending = [];
    let pendingSize = 0;

    while (true) {
      const data = socket.read();

      if (!data) {
        await once(socket, 'readable');
        continue;
      }

      pending.push(data);
      pendingSize += data.length;

      if (pendingSize < length) {
        continue;
      }

      const concat = Buffer.concat(pending);

      verify?.(concat);

      const remaining = concat.length % length;
      const left = concat.slice(0, concat.length - remaining);
      const right = concat.slice(concat.length - remaining);

      pending = [right];
      pendingSize = right.length;

      yield {
        chunks: [left],
      };
    }
  }

  return parse;
};

/**
 *
 * @url https://github.com/koush/scrypted/blob/fcfdadc9849099134e3f6ee6002fa1203bccdc91/common/src/stream-parser.ts#L92
 * (c) koush <https://github.com/koush>
 *
 **/
export const createMpegTsParser = () => {
  return {
    container: 'mpegts',
    outputArguments: '[f=mpegts]',
    parse: createLengthParser(188, (concat) => {
      if (concat[0] != 0x47) {
        throw new Error('Invalid sync byte in mpeg-ts packet. Terminating stream.');
      }
    }),
    findSyncFrame(streamChunks) {
      for (let prebufferIndex = 0; prebufferIndex < streamChunks.length; prebufferIndex++) {
        const streamChunk = streamChunks[prebufferIndex];

        for (let chunkIndex = 0; chunkIndex < streamChunk.chunks.length; chunkIndex++) {
          const chunk = streamChunk.chunks[chunkIndex];
          let offset = 0;

          while (offset + 188 < chunk.length) {
            const pkt = chunk.subarray(offset, offset + 188);
            const pid = ((pkt[1] & 0x1f) << 8) | pkt[2];

            if (
              pid == 256 && // found video stream
              pkt[3] & 0x20 &&
              pkt[4] > 0 && // have AF
              pkt[5] & 0x40
            ) {
              return streamChunks.slice(prebufferIndex);
            }

            offset += 188;
          }
        }
      }

      return findSyncFrame(streamChunks);
    },
  };
};

export const startFFMPegFragmetedMP4Session = async (
  cameraName,
  cameraDebug,
  videoProcessor,
  ffmpegInput,
  audioOutputArguments,
  videoOutputArguments
) => {
  const { log } = LoggerService;

  log.debug('Start recording...', cameraName);

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve) => {
    const server = createServer((socket) => {
      server.close();

      resolve({
        socket,
        cp,
        generator: parseFragmentedMP4(socket),
      });
    });

    const serverPort = await listenServer(server);
    const arguments_ = [
      '-hide_banner',
      //'-fflags',
      //'+genpts+igndts',
      ...ffmpegInput,
      '-f',
      'mp4',
      ...videoOutputArguments,
      ...audioOutputArguments,
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      '-max_muxing_queue_size',
      '1024',
      //'-vsync',
      //'cfr',
      'tcp://127.0.0.1:' + serverPort,
    ];

    log.debug(`Recording command: ${videoProcessor} ${arguments_.join(' ')}`, cameraName);

    const cp = spawn(videoProcessor, arguments_, { env: process.env });

    const stderr = readline.createInterface({
      input: cp.stderr,
      terminal: false,
    });

    let errors = [];

    stderr.on('line', (line) => {
      if (/\[(panic|fatal|error)]/.test(line)) {
        errors = errors.slice(-5);
        errors.push(line);

        log.debug(line, cameraName);
      } else if (cameraDebug) {
        log.debug(line, cameraName);
      }
    });

    cp.on('exit', (code, signal) => {
      if (code === 1) {
        errors.unshift(`FFmpeg recording process exited with error! (${signal})`);
        log.error(errors.join(' - '), cameraName, 'Homebridge');
      } else {
        log.debug('FFmpeg recording process exited (expected)', cameraName);
      }
    });
  });
};

export const generateInputSource = (videoConfig, source) => {
  let inputSource = source || videoConfig.source;

  if (inputSource) {
    if (videoConfig.readRate && !inputSource.includes('-re')) {
      inputSource = `-re ${inputSource}`;
    }

    if (videoConfig.stimeout > 0 && !inputSource.includes('-stimeout')) {
      inputSource = `-stimeout ${videoConfig.stimeout * 10000000} ${inputSource}`;
    }

    if (videoConfig.maxDelay >= 0 && !inputSource.includes('-max_delay')) {
      inputSource = `-max_delay ${videoConfig.maxDelay} ${inputSource}`;
    }

    if (videoConfig.reorderQueueSize >= 0 && !inputSource.includes('-reorder_queue_size')) {
      inputSource = `-reorder_queue_size ${videoConfig.reorderQueueSize} ${inputSource}`;
    }

    if (videoConfig.probeSize >= 32 && !inputSource.includes('-probesize')) {
      inputSource = `-probesize ${videoConfig.probeSize} ${inputSource}`;
    }

    if (videoConfig.analyzeDuration >= 0 && !inputSource.includes('-analyzeduration')) {
      inputSource = `-analyzeduration ${videoConfig.analyzeDuration} ${inputSource}`;
    }

    if (videoConfig.rtspTransport && !inputSource.includes('-rtsp_transport')) {
      inputSource = `-rtsp_transport ${videoConfig.rtspTransport} ${inputSource}`;
    }
  }

  return inputSource;
};

export const generateVideoConfig = (videoConfig) => {
  const config = { ...videoConfig };

  config.maxWidth = config.maxWidth || 1280;
  config.maxHeight = config.maxHeight || 720;
  config.maxFPS = config.maxFPS >= 20 ? videoConfig.maxFPS : 20;
  config.maxStreams = config.maxStreams >= 1 ? videoConfig.maxStreams : 4;
  config.maxBitrate = config.maxBitrate || 299;
  config.vcodec = config.vcodec || 'libx264';
  config.acodec = config.acodec || 'libfdk_aac';
  config.encoderOptions = config.encoderOptions || '';
  config.packetSize = config.packetSize || 1318;

  return config;
};

export const checkDeprecatedFFmpegArguments = (ffmpegVersion, ffmpegArguments) => {
  if (!ffmpegVersion || !compareVersions.validate(ffmpegVersion)) {
    return ffmpegArguments;
  }

  let ffmpegArgumentsArray = !Array.isArray(ffmpegArguments) ? ffmpegArguments.split(' ') : [...ffmpegArguments];

  if (compareVersions.compare(ffmpegVersion, '5.0.0', '>=')) {
    ffmpegArgumentsArray = ffmpegArgumentsArray.map((argument) => {
      if (argument === '-stimeout') {
        argument = '-timeout';
      }

      return argument;
    });
  }

  return ffmpegArgumentsArray;
};
