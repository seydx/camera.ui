'use-strict';

const { LoggerService } = require('../services/logger/logger.service');

const { Database } = require('./database');

const { log } = LoggerService;

const setAsyncTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Socket {
  #rooms = [];
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
          log.debug(`New WebSocket connection from ${socket.conn.remoteAddress} to room: stream/${data.feed}`);

          socket.join(`stream/${data.feed}`);

          this.#handleConntection(data.feed, data.destroy);
        }
      });

      socket.on('leave_stream', (data) => {
        if (data.feed) {
          log.debug(`${socket.conn.remoteAddress} disconnected or closed from room: stream/${data.feed}`);
          socket.leave(`stream/${data.feed}`);

          this.#handleConntection(data.feed);
        }
      });

      socket.on('disconnect', () => {
        log.debug(`${socket.conn.remoteAddress} disconnected from server`);

        for (const cameraName of this.#rooms) {
          this.#handleConntection(cameraName);
        }
      });
    });
  }

  async #handleConntection(cameraName, destroy) {
    if (destroy) {
      this.#handleStream(cameraName, 'stop');
      await setAsyncTimeout(1000);
    }

    const clients = Socket.io.sockets.adapter.rooms.get(`stream/${cameraName}`)
      ? Socket.io.sockets.adapter.rooms.get(`stream/${cameraName}`).size
      : 0;

    log.debug(`Active sockets in room (stream/${cameraName}): ${clients}`);

    let streamTimeout = this.#streamTimeouts.get(cameraName);

    if (streamTimeout) {
      clearTimeout(streamTimeout);
      this.#streamTimeouts.delete(cameraName);
    }

    if (clients) {
      if (!this.#rooms.includes(cameraName)) {
        this.#rooms.push(cameraName);
      }

      this.#handleStream(cameraName, 'start');
    } else {
      log.debug('If no clients connects to the Websocket, the stream will be closed in 15s');

      this.#rooms = this.#rooms.filter((room) => room !== cameraName);

      streamTimeout = setTimeout(() => {
        this.#handleStream(cameraName, 'stop');
      }, 15000);

      this.#streamTimeouts.set(cameraName, streamTimeout);
    }
  }

  async #handleStream(cameraName, target) {
    const { cameras } = require('../controller/camera/camera.controller').CameraController;
    const controller = cameras.get(cameraName);

    if (controller) {
      switch (target) {
        case 'start':
          controller.stream.start();
          break;
        case 'stop':
          controller.stream.stop();
          break;
      }
    }
  }
}

exports.Socket = Socket;
