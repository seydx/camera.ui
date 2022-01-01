/* eslint-disable unicorn/number-literal-case */
'use-strict';
const { once } = require('events');

function findSyncFrame(streamChunks) {
  return streamChunks;
}

module.exports = {
  listenServer: async function (server) {
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
  },

  readLength: function (readable, length) {
    if (!length) {
      return Buffer.alloc(0);
    }

    {
      const returnValue = readable.read(length);
      if (returnValue) {
        return returnValue;
      }
    }

    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      const r = () => {
        const returnValue = readable.read(length);

        if (returnValue) {
          cleanup();
          resolve(returnValue);
        }
      };

      const error = () => {
        cleanup();
        reject(`Stream ended during read for minimum ${length} bytes`);
      };

      const cleanup = () => {
        readable.removeListener('readable', r);
        readable.removeListener('end', error);
      };

      readable.on('readable', r);
      readable.on('end', error);
    });
  },

  parseFragmentedMP4: async function* (readable) {
    while (true) {
      const header = await this.readLength(readable, 8);
      const length = header.readInt32BE(0) - 8;
      const type = header.slice(4).toString();
      const data = await this.readLength(readable, length);

      yield {
        header,
        length,
        type,
        data,
      };
    }
  },

  createFragmentedMp4Parser: function (vcodec, acodec) {
    // eslint-disable-next-line unicorn/no-this-assignment
    const self = this;

    return {
      container: 'mp4',
      outputArguments: [...vcodec, ...acodec, '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4'],
      async *parse(socket) {
        const parser = self.parseFragmentedMP4(socket);

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
  },

  createLengthParser: function (length, verify) {
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
  },

  createPCMParser: function () {
    return {
      container: 's16le',
      outputArguments: ['-vn', '-acodec', 'pcm_s16le', '-f', 's16le'],
      parse: this.createLengthParser(512),
      findSyncFrame,
    };
  },

  createMpegTsParser: function (vcodec, acodec) {
    return {
      container: 'mpegts',
      outputArguments: [...vcodec, ...acodec, '-f', 'mpegts'],
      parse: this.createLengthParser(188, (concat) => {
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
  },

  generateInputSource: function (videoConfig) {
    let source = videoConfig.source;

    if (source) {
      if (videoConfig.readRate) {
        source = `-re ${source}`;
      }

      if (videoConfig.stimeout > 0) {
        source = `-stimeout ${videoConfig.stimeout * 10000000} ${source}`;
      }

      if (videoConfig.maxDelay >= 0) {
        source = `-max_delay ${videoConfig.maxDelay} ${source}`;
      }

      if (videoConfig.reorderQueueSize >= 0) {
        source = `-reorder_queue_size ${videoConfig.reorderQueueSize} ${source}`;
      }

      if (videoConfig.probeSize >= 32) {
        source = `-probesize ${videoConfig.probeSize} ${source}`;
      }

      if (videoConfig.analyzeDuration >= 0) {
        source = `-analyzeduration ${videoConfig.analyzeDuration} ${source}`;
      }

      if (videoConfig.rtspTransport) {
        source = `-rtsp_transport ${videoConfig.rtspTransport} ${source}`;
      }
    }

    return source;
  },
};
