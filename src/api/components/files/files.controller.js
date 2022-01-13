/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const path = require('path');

const SettingsModel = require('../settings/settings.model');

const { ConfigService } = require('../../../services/config/config.service');
const { LoggerService } = require('../../../services/logger/logger.service');

const { log } = LoggerService;

exports.serve = async (req, res, next) => {
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
