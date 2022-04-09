/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import Alexa from '../../../common/alexa.js';
import Cleartimer from '../../../common/cleartimer.js';

import CameraController from '../../../controller/camera/camera.controller.js';
import Database from '../../database.js';

import * as SettingsModel from './settings.model.js';

const { cameras } = CameraController;
const setTimeoutAsync = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const show = async (req, res) => {
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

export const getTarget = async (req, res) => {
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

export const patchTarget = async (req, res) => {
  try {
    if (req.body === undefined || Object.keys(req?.body).length === 0) {
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
      const cameraSettings = req.body;

      for (const camera of cameraSettings) {
        const controller = cameras.get(camera.name);
        controller?.videoanalysis.changeSettings(
          camera.videoanalysis.regions,
          camera.videoanalysis.sensitivity,
          camera.videoanalysis.difference,
          camera.videoanalysis.dwellTimer,
          camera.videoanalysis.forceCloseTimer
        );
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

export const reset = async (req, res) => {
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
