/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

const path = require('path');

const { ConfigService } = require('../../../services/config/config.service');

const SettingsModel = require('../settings/settings.model');

exports.serve = async (req, res) => {
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

    res.sendFile(file, options);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
