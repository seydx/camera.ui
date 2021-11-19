/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const { Alexa } = require('../../../common/alexa');
const { Cleartimer } = require('../../../common/cleartimer');

const { CameraController } = require('../../../controller/camera/camera.controller');
const { Database } = require('../../database');

const { LoggerService } = require('../../../services/logger/logger.service');

const SettingsModel = require('./settings.model');

const { cameras } = CameraController;
const { log } = LoggerService;

const setTimeoutAsync = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.show = async (req, res) => {
  try {
    const result = await SettingsModel.show(req.query.all);

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.getTarget = async (req, res) => {
  try {
    if (req.query.pingAlexa) {
      const status = await Alexa.connect();
      return res.status(200).send({ status: status ? 'success' : 'error' });
    }

    const result = await SettingsModel.getByTarget(req.query.all, req.params.target);

    if (!result) {
      res.status(404).send({
        statusCode: 404,
        message: 'Target not found',
      });
    }

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.patchTarget = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).send({
        statusCode: 400,
        message: 'Bad request',
      });
    }

    const result = await SettingsModel.getByTarget(req.query.all, req.params.target);

    if (!result) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Target not found',
      });
    }

    if (req.params.target === 'notifications' && req.query.reconnectAlexa === 'true') {
      const status = await Alexa.start(req.body);
      return res.status(200).send({ status: status ? 'success' : 'error' });
    }

    await SettingsModel.patchByTarget(req.query.all, req.params.target, req.body);

    if (req.params.target === 'cameras') {
      /*if (req.query.stopStream === 'true') {
        for (const controller of cameras.values()) {
          controller.stream?.stop();
        }
      }*/

      log.info('Camera settings changed. The changes take effect when the camera stream is restarted.');

      const cameraSettings = req.body;

      for (const camera of cameraSettings) {
        const controller = cameras.get(camera.name);

        let setting = {
          '-s': camera.resolution,
        };

        if (camera.audio) {
          controller?.stream?.delStreamOptions(['-an']);

          setting = {
            ...setting,
            '-codec:a': 'mp2',
            '-ar': '44100',
            '-ac': '1',
            '-b:a': '128k',
          };
        } else {
          controller?.stream?.delStreamOptions(['-codec:a', '-ar', '-ac', '-b:a']);
          setting['-an'] = '';
        }

        controller?.stream?.setStreamOptions(setting);
      }
    }

    if (req.params.target === 'general') {
      if (req.query.stopAutomation === 'true') {
        Database.stopAtHomeAutomation();
      }

      if (req.query.restartAutomation === 'true') {
        await Database.restartAtHomeAutomation();
      }
    }

    if (req.params.target === 'notifications') {
      if (req.query.cleartimer === 'restart') {
        Cleartimer.stopNotifications();
        await setTimeoutAsync(500);
        Cleartimer.startNotifications();
      }

      if (req.query.cleartimer === 'start') {
        Cleartimer.startNotifications();
      }

      if (req.query.cleartimer === 'stop') {
        Cleartimer.stopNotifications();
      }
    }

    if (req.params.target === 'recordings') {
      if (req.query.cleartimer === 'restart') {
        Cleartimer.stopRecordings();
        await setTimeoutAsync(500);
        Cleartimer.startRecordings();
      }

      if (req.query.cleartimer === 'start') {
        Cleartimer.startRecordings();
      }

      if (req.query.cleartimer === 'stop') {
        Cleartimer.stopRecordings();
      }
    }

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

exports.reset = async (req, res) => {
  try {
    await SettingsModel.resetSettings();

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
