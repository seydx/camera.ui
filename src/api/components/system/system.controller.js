/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const axios = require('axios');
const { exec } = require('child_process');

const { LoggerService } = require('../../../services/logger/logger.service');
const { ConfigService } = require('../../../services/config/config.service');

const { Database } = require('../../database');

const { log } = LoggerService;

let updating = false;

const updatePlugin = (version) => {
  return new Promise((resolve, reject) => {
    if (updating) {
      return;
    }

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
    const timeout = 5 * 60 * 1000; //5min
    req.setTimeout(timeout);
    res.setTimeout(timeout);

    Database.controller.emit('update');
    await updatePlugin(req.query.version);
    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
