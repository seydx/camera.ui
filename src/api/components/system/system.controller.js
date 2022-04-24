/* eslint-disable unicorn/better-regex */
/* eslint-disable unicorn/escape-case */
/* eslint-disable no-control-regex */
/* eslint-disable unicorn/no-hex-escape */
/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import axios from 'axios';
import { exec } from 'child_process';
import fs from 'fs-extra';
import systeminformation from 'systeminformation';

import LoggerService from '../../../services/logger/logger.service.js';
import ConfigService from '../../../services/config/config.service.js';

import Database from '../../database.js';
import Socket from '../../socket.js';

import MotionController from '../../../controller/motion/motion.controller.js';

const { log } = LoggerService;

let updating = false;

const setTimeoutAsync = (ms) => new Promise((res) => setTimeout(res, ms));

const updatePlugin = (version) => {
  return new Promise((resolve, reject) => {
    updating = true;

    const moduleName = ConfigService.env.moduleName;
    const globalPrefix = ConfigService.env.global;
    const sudoMode = ConfigService.env.sudo;

    const target = version ? version : 'latest';

    const cmd = `${sudoMode ? 'sudo npm i -E -n' : 'npm i'} ${globalPrefix ? '-g' : ''} ${moduleName}@${target}`;

    log.info(`Updating: ${cmd}`);

    exec(cmd, (error, stdout, stderr) => {
      if (error && error.code > 0) {
        updating = false;
        return reject(`Error with CMD: ${error.cmd}`);
      }

      if (stderr) {
        stderr = stderr.toString();

        if (!stderr.includes('npm WARN')) {
          updating = false;
          return reject(stderr);
        }
      }

      log.info('Successfully updated!');
      updating = false;

      resolve(true);
    });
  });
};

export const clearLog = async (req, res) => {
  try {
    const logPath = ConfigService.logFile;
    fs.truncate(logPath, (err) => {
      if (err) {
        return res.status(500).send({
          statusCode: 500,
          message: err.message,
        });
      }

      Socket.io.emit('clearLog');
      res.status(204).send({});
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const downloadDb = async (req, res, next) => {
  try {
    const dbPath = ConfigService.databaseFilePath;
    //const dbJson = JSON.stringify((await fs.readJSON(dbPath, { throws: false })) || {});

    res.header('Content-Type', 'application/json');
    res.sendFile(dbPath, (err) => {
      if (err) {
        if (err?.status === 404 || err?.statusCode === 404) {
          log.debug(err.message);
        }

        next();
      }
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const downloadLog = async (req, res) => {
  try {
    const logPath = ConfigService.logFile;
    //res.download(logPath);

    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', 'attachment; filename=camera.ui.log.txt');

    const readStream = fs.createReadStream(logPath);

    readStream.on('data', (data) => {
      res.write(data.toString().replace(/\x1b\[[0-9;]*m/g, ''));
    });

    readStream.on('end', async () => {
      res.status(200).send();
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const fetchNpm = async (req, res) => {
  try {
    const moduleName = ConfigService.env.moduleName;

    const response = await axios(`https://registry.npmjs.org/${moduleName}`, {
      headers: {
        accept: 'application/vnd.npm.install-v1+json',
      },
    });

    res.status(200).send(response.data);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getChangelog = async (req, res) => {
  try {
    const moduleName = ConfigService.env.moduleName;
    const version = req.query.version || ConfigService.version;

    const response = await axios(`https://unpkg.com/${moduleName}@${version}/CHANGELOG.md`);

    res.status(200).send(response.data);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getDiskLoad = async (req, res) => {
  try {
    await Socket.handleDiskUsage();
    res.status(200).send(Socket.diskSpace);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getFtpServerStatus = async (req, res) => {
  try {
    const status = MotionController.ftpServer.server.listening;

    res.status(200).send({
      status: status ? 'online' : 'offline',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getHttpServerStatus = async (req, res) => {
  try {
    const status = MotionController.httpServer.listening;

    res.status(200).send({
      status: status ? 'online' : 'offline',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getLog = async (req, res) => {
  try {
    const logPath = ConfigService.logFile;
    const truncateSize = 200000;
    const logStats = await fs.stat(logPath);
    const logStartPosition = logStats.size - truncateSize;
    const logBuffer = Buffer.alloc(truncateSize);

    const fd = await fs.open(logPath, 'r');
    // eslint-disable-next-line no-unused-vars
    const { bytesRead, buffer } = await fs.read(fd, logBuffer, 0, truncateSize, logStartPosition);

    res.status(200).send(buffer.toString());
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getMqttClientStatus = async (req, res) => {
  try {
    const status = MotionController.mqttClient.connected;

    res.status(200).send({
      status: status ? 'online' : 'offline',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getSmtpServerStatus = async (req, res) => {
  try {
    const status = MotionController.smtpServer.server.listening;

    res.status(200).send({
      status: status ? 'online' : 'offline',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getUptime = async (req, res) => {
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

    res.status(200).send({
      systemTime: humaniseDuration(systemTime ? systemTime.uptime : 0),
      processTime: humaniseDuration(processUptime),
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const lastModifiedDb = async (req, res) => {
  try {
    const dbPath = ConfigService.databaseFilePath;
    const dbFileInfo = await fs.stat(dbPath);

    res.status(200).send(dbFileInfo);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartFtpServer = async (req, res) => {
  try {
    MotionController.closeFtpServer();
    await setTimeoutAsync(1000);

    MotionController.startFtpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restarHttpServer = async (req, res) => {
  try {
    MotionController.closeHttpServer();
    await setTimeoutAsync(1000);

    MotionController.startHttpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartMqttClient = async (req, res) => {
  try {
    MotionController.closeMqttClient();
    await setTimeoutAsync(1000);

    MotionController.startMqttClient();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartSmtpServer = async (req, res) => {
  try {
    MotionController.closeSmtpServer();
    await setTimeoutAsync(1000);

    MotionController.startSmtpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartSystem = async (req, res) => {
  try {
    Database.controller.emit('restart');
    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopFtpServer = async (req, res) => {
  try {
    MotionController.closeFtpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopHttpServer = async (req, res) => {
  try {
    MotionController.closeHttpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopMqttClient = async (req, res) => {
  try {
    MotionController.closeMqttClient();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopSmtpServer = async (req, res) => {
  try {
    MotionController.closeSmtpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const updateSystem = async (req, res) => {
  try {
    if (updating) {
      return res.status(500).send({
        statusCode: 500,
        message: 'System update is already in progress',
      });
    }

    const timeout = 5 * 60 * 1000; //5min
    req.setTimeout(timeout);
    res.setTimeout(timeout);

    await updatePlugin(req.query.version);

    Database.controller.emit('updated');
    Socket.io.emit('updated');

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
