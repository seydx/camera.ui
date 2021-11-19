/* eslint-disable unicorn/explicit-length-check */
'use-strict';

const socketioJwt = require('socketio-jwt');

const { LoggerService } = require('../services/logger/logger.service');
const { ConfigService } = require('../services/config/config.service');

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

    Socket.io.use(
      socketioJwt.authorize({
        secret: ConfigService.interface.jwt_secret,
        handshake: true,
      })
    );

    Socket.io.on('connection', async (socket) => {
      //check if token is valid
      const token = socket.encoded_token;
      const tokenExist = Database.tokensDB.get('tokens').find({ token: token }).value();

      if (!tokenExist) {
        log.debug(
          `${socket.decoded_token.username} (${socket.conn.remoteAddress}) disconnecting from socket, not authenticated`
        );

        socket.emit('unauthenticated');
        setTimeout(() => socket.disconnect(true), 1000);

        return;
      }

      log.debug(
        `${socket.decoded_token.username} (${socket.conn.remoteAddress}) authenticated and connected to socket`
      );

      if (
        socket.decoded_token.permissionLevel.includes('notifications:access') ||
        socket.decoded_token.permissionLevel.includes('admin')
      ) {
        const notifications = await Database.interfaceDB.get('notifications').value();
        const systemNotifications = Database.notificationsDB.get('notifications').value();
        const size = notifications.length || systemNotifications.length;
        socket.emit('notification_size', size);
      } else {
        log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) no access for notifications socket`);
      }

      socket.on('join_stream', (data) => {
        if (data.feed) {
          socket.join(`stream/${data.feed}`);
          log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) joined stream: ${data.feed}`);
        }
      });

      socket.on('leave_stream', (data) => {
        if (data.feed) {
          socket.leave(`stream/${data.feed}`);
          log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) left stream: ${data.feed}`);
        }
      });

      socket.on('rejoin_stream', (data) => {
        if (data.feed) {
          socket.leave(`stream/${data.feed}`);
          socket.join(`stream/${data.feed}`);

          log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) re-joined stream: ${data.feed}`);
        }
      });

      socket.on('refresh_stream', (data) => {
        if (data.feed) {
          log.debug(
            `${socket.decoded_token.username} (${socket.conn.remoteAddress}) requested to restart stream: ${data.feed}`
          );
          this.#handleStream(data.feed, 'restart');
        }
      });

      socket.on('disconnect', () => {
        log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) disconnected from socket`);
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
