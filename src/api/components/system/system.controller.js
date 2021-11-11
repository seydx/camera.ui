/* eslint-disable unicorn/better-regex */
/* eslint-disable unicorn/escape-case */
/* eslint-disable no-control-regex */
/* eslint-disable unicorn/no-hex-escape */
/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs-extra');

const { LoggerService } = require('../../../services/logger/logger.service');
const { ConfigService } = require('../../../services/config/config.service');

const { Database } = require('../../database');
const { Socket } = require('../../socket');

const { log } = LoggerService;

let updating = false;

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

exports.getLog = async (req, res) => {
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

exports.downloadLog = async (req, res) => {
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

exports.getChangelog = async (req, res) => {
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

exports.fetchNpm = async (req, res) => {
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

exports.restartSystem = async (req, res) => {
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

exports.updateSystem = async (req, res) => {
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
