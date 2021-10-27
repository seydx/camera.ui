/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const http = require('http');
const https = require('https');

const { ConfigService } = require('../services/config/config.service');
const { LoggerService } = require('../services/logger/logger.service');

const { App } = require('./app');
const { Socket } = require('./socket');

const config = ConfigService;
const { log } = LoggerService;

class Server {
  #port = config.ui.port;
  #ssl = config.ui.ssl;
  #version = config.ui.version;

  constructor() {
    const app = App({
      debug: process.env.CUI_LOG_DEBUG === '1',
      version: this.#version,
    });

    const server = this.#ssl
      ? https.createServer(
          {
            key: this.#ssl.key,
            cert: this.#ssl.cert,
          },
          app
        )
      : http.createServer(app);

    Socket.create(server);

    server.on('listening', async () => {
      let addr = server.address();
      let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

      log.info(`camera.ui v${this.#version} is listening on ${bind} (${this.#ssl ? 'https' : 'http'})`);
    });

    server.on('error', (error) => {
      let error_;

      if (error.syscall !== 'listen') {
        log.error(error);
      }

      let bind = typeof port === 'string' ? 'Pipe ' + this.#port : 'Port ' + this.#port;

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

      log.error(error_);

      server.close();
    });

    server.on('close', () => {
      log.debug('User interface closed');
    });

    return server;
  }
}

exports.Server = Server;
