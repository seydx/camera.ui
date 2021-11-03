/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const axios = require('axios');
const { exec } = require('child_process');

const { Database } = require('../../database');

//TODO: We assume that the plugin is installed globally with sudo, this should possibly be changed in the future.
const updatePlugin = (version) => {
  return new Promise((resolve, reject) => {
    const target = version ? version : 'latest';

    exec(`sudo npm i -g -E -n camera.ui@${target}`, (error, stdout, stderr) => {
      if (error && error.code > 0) {
        return reject(`Error with CMD: ${error.cmd}`);
      }

      if (stderr) {
        stderr = stderr.toString();

        if (!stderr.includes('npm WARN')) {
          return reject(stderr);
        }
      }

      resolve(true);
    });
  });
};

exports.fetchNpm = async (req, res) => {
  try {
    const response = await axios('https://registry.npmjs.org/camera.ui', {
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
    //Database.controller.emit('update');
    await updatePlugin(req.query.version);
    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
