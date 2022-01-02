/* eslint-disable unicorn/explicit-length-check */
'use-strict';

const socketioJwt = require('socketio-jwt');
const systeminformation = require('systeminformation');

const { LoggerService } = require('../services/logger/logger.service');
const { ConfigService } = require('../services/config/config.service');

const { Database } = require('./database');

const { CameraController } = require('../controller/camera/camera.controller');
const { MotionController } = require('../controller/motion/motion.controller');

const { log } = LoggerService;

class Socket {
  #streamTimeouts = new Map();

  static #uptime = {
    systemTime: '0m',
    processTime: '0m',
  };
  static #cpuLoadHistory = [];
  static #cpuTempHistory = [];
  static #memoryUsageHistory = [];

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
        const size = notifications.length + systemNotifications.length;

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

      socket.on('getUptime', () => {
        Socket.io.emit('uptime', Socket.#uptime);
      });

      socket.on('getCpuLoad', () => {
        Socket.io.emit('cpuLoad', Socket.#cpuLoadHistory);
      });

      socket.on('getCpuTemp', () => {
        Socket.io.emit('cpuTemp', Socket.#cpuTempHistory);
      });

      socket.on('getMemory', () => {
        Socket.io.emit('memory', Socket.#memoryUsageHistory);
      });

      socket.on('getMotionServerStatus', () => {
        const ftpStatus = MotionController.ftpServer?.server?.listening;
        const httpStatus = MotionController.httpServer?.listening;
        const mqttStatus = MotionController.mqttClient?.connected;
        const smtpStatus = MotionController.smtpServer?.server?.listening;

        Socket.io.emit('motionServerStatus', {
          ftpStatus: ftpStatus ? 'online' : 'offline',
          httpStatus: httpStatus ? 'online' : 'offline',
          mqttStatus: mqttStatus ? 'online' : 'offline',
          smtpStatus: smtpStatus ? 'online' : 'offline',
        });

        Socket.io.emit('ftpStatus', {
          status: ftpStatus ? 'online' : 'offline',
        });

        Socket.io.emit('httpStatus', {
          status: httpStatus ? 'online' : 'offline',
        });

        Socket.io.emit('mqttStatus', {
          status: mqttStatus ? 'online' : 'offline',
        });

        Socket.io.emit('smtpStatus', {
          status: smtpStatus ? 'online' : 'offline',
        });
      });

      socket.on('getCameraPrebufferSatus', (cameras) => {
        if (!Array.isArray(cameras)) {
          cameras = [cameras];
        }

        for (const cameraName of cameras) {
          const controller = CameraController.cameras.get(cameraName);
          const state = controller?.prebuffer?.prebufferSession?.isActive();

          socket.emit('prebufferStatus', {
            camera: cameraName,
            status: state ? 'active' : 'inactive',
          });
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

    Socket.handleUptime();
    Socket.handleCpuLoad();
    Socket.handleCpuTemperature();
    Socket.handleMemoryUsage();

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

  static async handleUptime() {
    try {
      const humaniseDuration = (seconds) => {
        if (seconds < 50) {
          return '0m';
        }
        if (seconds < 3600) {
          return Math.round(seconds / 60) + 'm';
        }
        if (seconds < 86400) {
          return Math.round(seconds / 60 / 60) + 'h';
        }
        return Math.floor(seconds / 60 / 60 / 24) + 'd';
      };

      const systemTime = await systeminformation.time();
      const processUptime = process.uptime();

      Socket.#uptime = {
        systemTime: humaniseDuration(systemTime ? systemTime.uptime : 0),
        processTime: humaniseDuration(processUptime),
      };
    } catch (error) {
      log.error(error, 'Socket');
    } finally {
      Socket.io.emit('uptime', Socket.#uptime);

      setTimeout(() => {
        Socket.handleUptime();
      }, 30000);
    }
  }

  static async handleCpuLoad() {
    try {
      const cpuLoad = await systeminformation.currentLoad();

      Socket.#cpuLoadHistory = Socket.#cpuLoadHistory.slice(-60);
      Socket.#cpuLoadHistory.push({
        time: new Date(),
        value: cpuLoad ? cpuLoad.currentLoad : 0,
      });
    } catch (error) {
      log.error(error, 'Socket');
    } finally {
      Socket.io.emit('cpuLoad', Socket.#cpuLoadHistory);

      setTimeout(() => {
        Socket.handleCpuLoad();
      }, 20000);
    }
  }

  static async handleCpuTemperature() {
    try {
      const cpuTemperatureData = await systeminformation.cpuTemperature();

      Socket.#cpuTempHistory = Socket.#cpuTempHistory.slice(-60);
      Socket.#cpuTempHistory.push({
        time: new Date(),
        value: cpuTemperatureData ? cpuTemperatureData.main : 0,
      });
    } catch (error) {
      log.error(error, 'Socket');
    } finally {
      Socket.io.emit('cpuTemp', Socket.#cpuTempHistory);

      setTimeout(() => {
        Socket.handleCpuTemperature();
      }, 20000);
    }
  }

  static async handleMemoryUsage() {
    try {
      const mem = await systeminformation.mem();
      const memoryFreePercent = mem ? ((mem.total - mem.available) / mem.total) * 100 : 50;

      Socket.#memoryUsageHistory = Socket.#memoryUsageHistory.slice(-60);
      Socket.#memoryUsageHistory.push({
        time: new Date(),
        value: memoryFreePercent,
        available: mem ? (mem.available / 1024 / 1024 / 1024).toFixed(2) : 4,
        total: mem ? (mem.total / 1024 / 1024 / 1024).toFixed(2) : 8,
      });
    } catch (error) {
      log.error(error, 'Socket');
    } finally {
      Socket.io.emit('memory', Socket.#memoryUsageHistory);

      setTimeout(() => {
        Socket.handleMemoryUsage();
      }, 20000);
    }
  }
}

exports.Socket = Socket;
