/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import http from 'http';
import https from 'https';

import App from './app.js';

export default class Server {
  constructor(controller) {
    const log = controller.log;
    const config = controller.config;

    const app = new App({
      debug: process.env.CUI_LOG_DEBUG === '1',
      version: config.version,
    });

    const server = config.ssl
      ? https.createServer(
          {
            key: config.ssl.key,
            cert: config.ssl.cert,
          },
          app
        )
      : http.createServer(app);

    server.on('listening', async () => {
      let addr = server.address();
      let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

      log.info(`camera.ui v${config.version} is listening on ${bind} (${config.ssl ? 'https' : 'http'})`);

      controller.emit('finishLaunching');
    });

    server.on('error', (error) => {
      let error_;

      if (error.syscall !== 'listen') {
        log.error(error, 'Interface', 'server');
      }

      let bind = typeof port === 'string' ? 'Pipe ' + config.port : 'Port ' + config.port;

      switch (error.code) {
        case 'EACCES':
          error_ = `Can not start the User Interface! ${bind} requires elevated privileges`;
          break;
        case 'EADDRINUSE':
          error_ = `Can not start the User Interface! ${bind} is already in use`;
          break;
        default:
          error_ = error;
      }

      log.error(error_, 'Interface', 'server');

      server.close();
    });

    server.on('close', () => {
      log.debug('User interface closed');
      controller.emit('shutdown');
    });

    return server;
  }
}
