'use-strict';

const { LoggerService } = require('../services/logger/logger.service');

const { Database } = require('./database');

const { CameraController } = require('../controller/camera/camera.controller');

const { log } = LoggerService;

class Socket {
  #streamTimeouts = new Map();

  static io;

  static create = (server) => new Socket(server);

  constructor(server) {
    Socket.io = LoggerService.socket = require('socket.io')(server, {
      cors: {
        origin: '*',
      },
    });

    Socket.io.on('connection', async (socket) => {
      log.debug(`${socket.conn.remoteAddress} connected to server`);

      const notifications = await Database.interfaceDB.get('notifications').value();
      socket.emit('notification_size', notifications.length);

      socket.on('join_stream', (data) => {
        if (data.feed) {
          socket.join(`stream/${data.feed}`);
          log.debug(`${socket.conn.remoteAddress} joined room: stream/${data.feed}`);
        }
      });

      socket.on('leave_stream', (data) => {
        if (data.feed) {
          socket.leave(`stream/${data.feed}`);
          log.debug(`${socket.conn.remoteAddress} left room: stream/${data.feed}`);
        }
      });

      socket.on('rejoin_stream', (data) => {
        if (data.feed) {
          socket.leave(`stream/${data.feed}`);
          socket.join(`stream/${data.feed}`);

          log.debug(`${socket.conn.remoteAddress} re-joined room: stream/${data.feed}`);
        }
      });

      socket.on('refresh_stream', (data) => {
        if (data.feed) {
          log.debug(`${socket.conn.remoteAddress} requested to restart ${data.feed} stream`);
          this.#handleStream(data.feed, 'restart');
        }
      });

      socket.on('disconnect', () => {
        log.debug(`${socket.conn.remoteAddress} disconnected from server`);
      });
    });

    Socket.io.of('/').adapter.on('join-room', (room) => {
      if (room.startsWith('stream/')) {
        const cameraName = room.split('/')[1];
        const clients = Socket.io.sockets.adapter.rooms.get(`stream/${cameraName}`)?.size || 0;

        log.debug(`Active sockets in room (stream/${cameraName}): ${clients}`);

        let streamTimeout = this.#streamTimeouts.get(cameraName);

        if (streamTimeout) {
          clearTimeout(streamTimeout);
          this.#streamTimeouts.delete(cameraName);
        } else if (clients < 2) {
          this.#handleStream(cameraName, 'start');
        }
      }
    });

    Socket.io.of('/').adapter.on('leave-room', (room) => {
      if (room.startsWith('stream/')) {
        const cameraName = room.split('/')[1];
        const clients = Socket.io.sockets.adapter.rooms.get(`stream/${cameraName}`)?.size || 0;

        log.debug(`Active sockets in room (stream/${cameraName}): ${clients}`);

        if (!clients) {
          let streamTimeout = this.#streamTimeouts.get(cameraName);

          if (!streamTimeout) {
            log.debug('If no clients connects to the Websocket, the stream will be closed in 15s');

            streamTimeout = setTimeout(() => {
              this.#handleStream(cameraName, 'stop');
              this.#streamTimeouts.delete(cameraName);
            }, 15000);

            this.#streamTimeouts.set(cameraName, streamTimeout);
          }
        }
      }
    });

    Socket.io.of('/').adapter.on('delete-room', (room) => {
      if (room.startsWith('stream/')) {
        const cameraName = room.split('/')[1];
        let streamTimeout = this.#streamTimeouts.get(cameraName);

        if (!streamTimeout) {
          log.debug('If no clients connects to the Websocket, the stream will be closed in 15s');

          streamTimeout = setTimeout(() => {
            this.#handleStream(cameraName, 'stop');
            this.#streamTimeouts.delete(cameraName);
          }, 15000);

          this.#streamTimeouts.set(cameraName, streamTimeout);
        }
      }
    });

    return Socket.io;
  }

  async #handleStream(cameraName, target) {
    const controller = CameraController.cameras.get(cameraName);

    if (controller) {
      switch (target) {
        case 'start':
          controller.stream.start();
          break;
        case 'stop':
          controller.stream.stop();
          break;
        case 'restart':
          controller.stream.restart();
          break;
      }
    }
  }
}

exports.Socket = Socket;
