'use-strict';

const { once } = require('events');

module.exports = {
  listenServer: async function (cameraName, server) {
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

    const returnValue = readable.read(length);

    if (returnValue) {
      return returnValue;
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

  parseFragmentedMP4: async function* (cameraName, readable) {
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
};
