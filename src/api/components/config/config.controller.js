/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import fs from 'fs-extra';

import * as ConfigModel from './config.model.js';

import LoggerService from '../../../services/logger/logger.service.js';
import ConfigService from '../../../services/config/config.service.js';

const { log } = LoggerService;

export const downloadConfig = async (req, res, next) => {
  try {
    const configPath = ConfigService.configPath;

    res.header('Content-Type', 'application/json');
    res.sendFile(configPath, (err) => {
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

export const lastModifiedConfig = async (req, res) => {
  try {
    const configPath = ConfigService.configPath;
    const configFileInfo = await fs.stat(configPath);

    res.status(200).send(configFileInfo);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const show = async (req, res) => {
  try {
    const result = await ConfigModel.show(req.jwt, req.query.target);

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const patchConfig = async (req, res) => {
  try {
    if (req.body === undefined || Object.keys(req?.body).length === 0) {
      return res.status(400).send({
        statusCode: 400,
        message: 'Bad request',
      });
    }

    await ConfigModel.patchConfig(req.body);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
