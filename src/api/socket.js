/* eslint-disable unicorn/explicit-length-check */
'use-strict';

import checkDiskSpace from 'check-disk-space';
import getFolderSize from 'get-folder-size';
import { Server } from 'socket.io';
import socketioJwt from 'socketio-jwt';
import systeminformation from 'systeminformation';

import LoggerService from '../services/logger/logger.service.js';
import ConfigService from '../services/config/config.service.js';

import Database from './database.js';

import CameraController from '../controller/camera/camera.controller.js';
import MotionController from '../controller/motion/motion.controller.js';
import * as TemperaturesModel from '../api/components/temperatures/temperatures.model.js';
import * as CamerasModel from '../api/components/cameras/cameras.model.js';

import fetch from 'node-fetch';

const { log } = LoggerService;

export default class Socket {
  #streamTimeouts = new Map();

  static #uptime = {
    systemTime: '0m',
    processTime: '0m',
  };

  static #cpuLoadHistory = [];
  static #cameraTempsHistory = [];
  static #cpuTempHistory = [];
  static #memoryUsageHistory = [];
  static #diskSpaceHistory = [];

  static diskSpace = {
    free: null,
    total: null,
    used: null,
    usedRecordings: null,
  };

  static io;

  static create = (server) => new Socket(server);

  constructor(server) {
    Socket.io = LoggerService.socket = new Server(server, {
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
      const tokenExist = Database.tokensDB?.chain.get('tokens').find({ token: token }).value();

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
        const notifications = await Database.interfaceDB?.chain.get('notifications').cloneDeep().value();
        const systemNotifications = Database.notificationsDB?.chain.get('notifications').cloneDeep().value();

        if (notifications && systemNotifications) {
          const size = notifications.length + systemNotifications.length;
          socket.emit('notification_size', size);
        }
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

      socket.on('getCameraTemps', () => {
        Socket.io.emit('cameraTemps', Socket.#cameraTempsHistory);
      });

      socket.on('getCpuTemp', () => {
        Socket.io.emit('cpuTemp', Socket.#cpuTempHistory);
      });

      socket.on('getMemory', () => {
        Socket.io.emit('memory', Socket.#memoryUsageHistory);
      });

      socket.on('getDiskSpace', () => {
        Socket.io.emit('diskSpace', Socket.#diskSpaceHistory);
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

      socket.on('getCameraVideoanalysisSatus', (cameras) => {
        if (!Array.isArray(cameras)) {
          cameras = [cameras];
        }

        for (const cameraName of cameras) {
          const controller = CameraController.cameras.get(cameraName);
          const state = controller?.videoanalysis?.videoanalysisSession?.isActive();

          socket.emit('videoanalysisStatus', {
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

  static async watchSystem() {
    await Socket.#handleUptime();
    await Socket.#handleCpuLoad();
    await Socket.#handleCpuTemperature();
    await Socket.#handleMemoryUsage();
    await Socket.handleDiskUsage();

    setTimeout(() => {
      Socket.watchSystem();
    }, 4000);
  }
  static async watchTemps() {
    await Socket.#handleCameraTemperature();

    setTimeout(() => {
      Socket.watchTemps();
    }, 60000 * 1);
  }

  static async watchStatus() {
    await Socket.#handleCameraStatus();

    setTimeout(() => {
      Socket.watchStatus();
    }, 60000 * 1);
  }

  static async #handleUptime() {
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

      const systemTime = systeminformation.time();
      const processUptime = process.uptime();

      Socket.#uptime = {
        systemTime: humaniseDuration(systemTime ? systemTime.uptime : 0),
        processTime: humaniseDuration(processUptime),
      };
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('uptime', Socket.#uptime);
  }

  static async #handleCameraTemperature() {
    const cameras = ConfigService.ui.cameras;
    for (const camera of cameras) {
      if (camera.thermalReporting == true) {
        try {
          switch (camera.type) {
            case 'Fixed':
              {
                var rawNames = [];
                var regions = [];
                var regex = /=(.*)/;
                var goods = [];
                var formatted = [];
                var ip;
                var credsRaw;
                if (camera.iis) {
                  ip = camera.videoConfig.source.slice(
                    camera.videoConfig.source.indexOf('@') + 1,
                    camera.videoConfig.source.lastIndexOf(':')
                  );

                  credsRaw = camera.videoConfig.source.slice(
                    camera.videoConfig.source.indexOf('/') + 2,
                    camera.videoConfig.source.lastIndexOf('@')
                  );
                } else {
                  ip = camera.videoConfig.source.slice(
                    getIndex(camera.videoConfig.source, '@', 2) + 1,
                    camera.videoConfig.source.lastIndexOf(':')
                  );

                  credsRaw = camera.videoConfig.source.slice(
                    camera.videoConfig.source.indexOf('/') + 2,
                    getIndex(camera.videoConfig.source, '@', 2)
                  );
                }

                const creds = credsRaw.split(':');

                await fetch(
                  `http://${ip}/cgi-bin/param.cgi?userName=${creds[0]}&password=${creds[1]}&action=get&type=temperAlarmParam&measureMode=0&measureID=0&areaID=-1`,
                  {
                    method: 'GET', // *GET, POST, PUT, DELETE, etc.
                  }
                )
                  .then((response) => response.text())
                  .then((data) => {
                    //console.log(data.split(/\r?\n/));
                    rawNames = data.split(/\r?\n/);
                    for (const [index, rawName] of rawNames.entries()) {
                      if (rawName.startsWith('areaId')) {
                        data = {
                          regionId: rawNames[index].match(regex)[1],
                          regionName: rawNames[index + 1].match(regex)[1],
                        };
                        regions.push(data);
                      }
                      //Do something
                    }
                  });

                await fetch(
                  `http://${ip}/cgi-bin/param.cgi?userName=${creds[0]}&password=${creds[1]}&action=get&type=areaTemperature&AreaID=-1`,
                  {
                    method: 'GET', // *GET, POST, PUT, DELETE, etc.
                  }
                )
                  .then((response) => response.text())
                  .then((data) => {
                    goods = data.split(/\r?\n/);
                    for (var index = 0; index < goods.length; index++) {
                      if (goods[index].startsWith('areaID')) {
                        data = {
                          cameraName: camera.name,
                          regionId: `${regions.find((x) => x.regionId == goods[index].match(regex)[1]).regionName}[${
                            regions.find((x) => x.regionId == goods[index].match(regex)[1]).regionId
                          }]`,
                          presetId: '1',
                          maxTemp: goods[index + 4].match(regex)[1],
                          minTemp: goods[index + 7].match(regex)[1],
                          avgTemp: goods[index + 8].match(regex)[1],
                        };
                        formatted.push(data);
                        Socket.#cameraTempsHistory.push(data);
                        TemperaturesModel.createTemperature(data);
                        //Add to mongo here
                      }
                      //Do something
                    }
                    console.log(`Temperatures Log Create Successfully for ${camera.name}`);
                    Socket.io.emit('cameraTemps', Socket.#cameraTempsHistory);
                  });
              }
              // Emit Socket Message with following data: camera.name, preset.id, region.id, temp, dateTime (round up to nearest minute)
              break;
            case 'PTZ':
              {
                var regexPTZ = /=(.*)/;
                if (camera.iis) {
                  ip = camera.videoConfig.source.slice(
                    camera.videoConfig.source.indexOf('@') + 1,
                    camera.videoConfig.source.lastIndexOf(':')
                  );

                  credsRaw = camera.videoConfig.source.slice(
                    camera.videoConfig.source.indexOf('/') + 2,
                    camera.videoConfig.source.lastIndexOf('@')
                  );
                } else {
                  ip = camera.videoConfig.source.slice(
                    getIndex(camera.videoConfig.source, '@', 2) + 1,
                    camera.videoConfig.source.lastIndexOf(':')
                  );

                  credsRaw = camera.videoConfig.source.slice(
                    camera.videoConfig.source.indexOf('/') + 2,
                    getIndex(camera.videoConfig.source, '@', 2)
                  );
                }

                const creds = credsRaw.split(':');

                var temporaryLog;

                await fetch(
                  `http://${ip}/cgi-bin/param.cgi?userName=${creds[0]}&password=${creds[1]}&action=get&type=areaTemperature&areaID=-1`,
                  {
                    method: 'GET', // *GET, POST, PUT, DELETE, etc.
                  }
                )
                  .then((response) => response.text())
                  .then(async (data) => {
                    var rawNames = data.split(/\r?\n/);
                    if (rawNames[0] === 'areaTemperatureBegin=1' && rawNames[1] === 'areaTemperatureEnd') {
                      console.log('Camera is navigating between presets.');
                      return;
                    }

                    for (const [index, rawName] of rawNames.entries()) {
                      var regionName;
                      if (rawName.startsWith('areaID')) {
                        temporaryLog = {
                          cameraName: camera.name,
                          regionId: `${rawNames[index].match(regexPTZ)[1]}`,
                          presetId: `${rawNames[2].match(regexPTZ)[1]}[${rawNames[1].match(regexPTZ)[1]}]`,
                          maxTemp: rawNames[index + 4].match(regexPTZ)[1],
                          minTemp: rawNames[index + 7].match(regexPTZ)[1],
                          avgTemp: rawNames[index + 8].match(regexPTZ)[1],
                        };

                        await fetch(
                          `http://${ip}/cgi-bin/param.cgi?userName=${creds[0]}&password=${creds[1]}&action=get&type=temperAlarmParam&measureMode=0&measureID=${temporaryLog.presetId}&areaID=-1`,
                          {
                            method: 'GET', // *GET, POST, PUT, DELETE, etc.
                          }
                        )
                          .then((response) => response.text())
                          .then(async (data) => {
                            var rawRegionNames = data.split(/\r?\n/);

                            for (const [index, rawRegionName] of rawRegionNames.entries()) {
                              if (rawRegionName.startsWith(`areaId=${temporaryLog.regionId}`)) {
                                regionName = rawRegionNames[index + 1].match(regexPTZ)[1];
                              }
                            }
                          });

                        temporaryLog.regionId = `${regionName}[${temporaryLog.regionId}]`;

                        Socket.#cameraTempsHistory.push(temporaryLog);
                        await TemperaturesModel.createTemperature(temporaryLog);
                        console.log(temporaryLog);
                        Socket.io.emit('cameraTemps', Socket.#cameraTempsHistory);
                      }
                    }
                  });
              }
              break;

            default:
          }
        } catch (error) {
          console.log(error);
        }
      }
    }
  }

  static async #handleCameraStatus() {
    const cameras = ConfigService.ui.cameras;
    for (const camera of cameras) {
      const status = await CamerasModel.pingCamera(camera, 6);
      console.log(`status for ${camera.name} is online: ${status}`);
      camera.online = status;
      await CamerasModel.patchCamera(camera.name, camera);
    }
  }

  static async #handleCpuLoad() {
    try {
      const cpuLoad = await systeminformation.currentLoad();
      let processLoad = await systeminformation.processLoad(process.title);

      if (processLoad?.length && !processLoad[0].pid && !processLoad[0].cpu && !processLoad[0].mem) {
        // can not find through process.title, try again with process.pid
        const processes = await systeminformation.processes();
        const processByPID = processes.list.find((p) => p.pid === process.pid);

        if (processByPID) {
          processLoad = [
            {
              cpu: processByPID.cpu,
            },
          ];
        }
      }

      Socket.#cpuLoadHistory = Socket.#cpuLoadHistory.slice(-60);
      Socket.#cpuLoadHistory.push({
        time: new Date(),
        value: cpuLoad ? cpuLoad.currentLoad : 0,
        value2: processLoad?.length ? processLoad[0].cpu || 0 : 0,
      });
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('cpuLoad', Socket.#cpuLoadHistory);
  }

  static async #handleCpuTemperature() {
    try {
      const cpuTemperatureData = await systeminformation.cpuTemperature();

      Socket.#cpuTempHistory = Socket.#cpuTempHistory.slice(-60);
      Socket.#cpuTempHistory.push({
        time: new Date(),
        value: cpuTemperatureData ? cpuTemperatureData.main : 0,
      });
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('cpuTemp', Socket.#cpuTempHistory);
  }

  static async #handleMemoryUsage() {
    try {
      const mem = await systeminformation.mem();
      const memoryFreePercent = mem ? ((mem.total - mem.available) / mem.total) * 100 : 50;
      let processLoad = await systeminformation.processLoad(process.title);

      if (!processLoad.pid && !processLoad.cpu && !processLoad.mem) {
        // can not find through process.title, try again with process.pid
        const processes = await systeminformation.processes();
        const processByPID = processes.list.find((p) => p.pid === process.pid);

        if (processByPID) {
          processLoad = [
            {
              mem: processByPID.mem,
            },
          ];
        }
      }

      Socket.#memoryUsageHistory = Socket.#memoryUsageHistory.slice(-60);
      Socket.#memoryUsageHistory.push({
        time: new Date(),
        value: memoryFreePercent,
        value2: processLoad?.length ? processLoad[0].mem || 0 : 0,
        available: mem ? (mem.available / 1024 / 1024 / 1024).toFixed(2) : 4,
        total: mem ? (mem.total / 1024 / 1024 / 1024).toFixed(2) : 8,
      });
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('memory', Socket.#memoryUsageHistory);
  }

  static async handleDiskUsage() {
    try {
      const settingsDatabase = await Database.interfaceDB.chain.get('settings').cloneDeep().value();
      const recordingsPath = settingsDatabase?.recordings.path;

      if (!recordingsPath) {
        return;
      }

      const diskSpace = await checkDiskSpace(recordingsPath);
      const recordingsSpace = await getFolderSize.loose(recordingsPath);

      Socket.diskSpace = {
        available: diskSpace.free / 1e9,
        total: diskSpace.size / 1e9,
        used: (diskSpace.size - diskSpace.free) / 1e9,
        usedRecordings: recordingsSpace / 1e9,
        recordingsPath: recordingsPath,
      };

      const usedPercent = Socket.diskSpace.used / Socket.diskSpace.total;
      const usedRecordingsPercent = Socket.diskSpace.usedRecordings / Socket.diskSpace.total;

      Socket.#diskSpaceHistory = Socket.#diskSpaceHistory.slice(-60);
      Socket.#diskSpaceHistory.push({
        time: new Date(),
        value: usedPercent * 100,
        value2: usedRecordingsPercent * 100,
        available: Socket.diskSpace.available.toFixed(2),
        total: Socket.diskSpace.total.toFixed(2),
      });
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('diskSpace', Socket.#diskSpaceHistory);
  }
}
function getIndex(string_, char, n) {
  return string_.split(char).slice(0, n).join(char).length;
}
