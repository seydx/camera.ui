/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import fs from 'fs-extra';

import * as BackupModel from './backup.model.js';

export const download = async (req, res) => {
  try {
    const localStorage = req.query.localStorage ? JSON.parse(req.query.localStorage) : false;
    const backup = await BackupModel.createBackup(localStorage);

    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename=${backup.backupFileName}`);

    const readStream = fs.createReadStream(backup.backupPath);

    readStream.on('data', (data) => {
      res.write(data);
    });

    readStream.on('end', async () => {
      await BackupModel.removeBackup(backup);
      res.status(200).send();
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restore = async (req, res) => {
  try {
    const localStorage = await BackupModel.restoreBackup(req.file);
    res.status(201).send(localStorage);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
