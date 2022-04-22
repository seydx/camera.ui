/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import http from 'http';
import https from 'https';

import ConfigService from '../services/config/config.service.js';
import LoggerService from '../services/logger/logger.service.js';

const { log } = LoggerService;

import App from './app.js';

export default class Server {
  constructor(controller) {
    const app = new App({
      debug: process.env.CUI_LOG_MODE === '2',
      version: ConfigService.ui.version,
    });

    const server = ConfigService.ui.ssl
      ? https.createServer(
          {
            key: ConfigService.ui.ssl.key,
            cert: ConfigService.ui.ssl.cert,
          },
          app
        )
      : http.createServer(app);

    server.on('listening', async () => {
      let addr = server.address();
      let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

      log.info(
        `camera.ui v${ConfigService.ui.version} is listening on ${bind} (${ConfigService.ui.ssl ? 'https' : 'http'})`
      );

      controller.emit('finishLaunching');
    });

    server.on('error', (error) => {
      let error_;

      if (error.syscall !== 'listen') {
        log.error(error, 'Interface', 'server');
      }

      let bind = typeof port === 'string' ? 'Pipe ' + ConfigService.ui.port : 'Port ' + ConfigService.ui.port;

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
