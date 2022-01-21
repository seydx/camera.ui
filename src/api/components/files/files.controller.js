/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import path from 'path';

import * as SettingsModel from '../settings/settings.model.js';

import ConfigService from '../../../services/config/config.service.js';
import LoggerService from '../../../services/logger/logger.service.js';

const { log } = LoggerService;

export const serve = async (req, res, next) => {
  try {
    const recordingSettings = await SettingsModel.getByTarget(false, 'recordings');

    let file = req.params.file;
    let recPath = recordingSettings.path;

    if (file.includes('photo_')) {
      file = file.includes('?r=') ? file.split('?r=')[0] : file;
      recPath = ConfigService.databaseUserPath;
    }

    let options = {
      root: path.join(recPath),
    };

    res.sendFile(file, options, (err) => {
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
