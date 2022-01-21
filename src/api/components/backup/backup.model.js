'use-strict';

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import tar from 'tar';

import ConfigService from '../../../services/config/config.service.js';
import LoggerService from '../../../services/logger/logger.service.js';

import Database from '../../database.js';

const { log } = LoggerService;

/**
 *
 * @url https://github.com/oznu/homebridge-config-ui-x/blob/441fa8b3df6e24dc51b7033a64441e03bd9ed988/src/modules/backup/backup.service.ts
 * (c) oznu <https://github.com/oznu>
 *
 **/
export const createBackup = async (localStorage) => {
  const recordingsPath = await Database.interfaceDB.chain
    .get('settings')
    .get('recordings')
    .get('path')
    .cloneDeep()
    .value();

  const backupDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'cameraui-backup-'));
  const backupFileName = 'cameraui-backup.tar.gz';
  const backupPath = path.resolve(backupDirectory, backupFileName);

  log.info(`Creating temporary backup archive at ${backupPath}`);

  // create a copy of the db and recordings dir
  await fs.copy(ConfigService.databasePath, path.resolve(backupDirectory, 'database'));
  await fs.copy(recordingsPath, path.resolve(backupDirectory, 'recordings'));

  // create a info.json
  await fs.writeJson(path.resolve(backupDirectory, 'info.json'), {
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    node: process.version,
    firstStart: await Database.interfaceDB.chain.get('firstStart').cloneDeep().value(),
    version: ConfigService.ui.version,
    database: Database.databasePath,
    recordings: recordingsPath,
    localStorage: {
      camviewLayout: localStorage && localStorage.camviewLayout ? JSON.parse(localStorage.camviewLayout) : {},
      dashboardLayout: localStorage && localStorage.dashboardLayout ? JSON.parse(localStorage.dashboardLayout) : [],
      theme: localStorage && localStorage.theme ? localStorage.theme : 'light',
      themeColor: localStorage && localStorage.themeColor ? localStorage.themeColor : 'pink',
      language: localStorage && localStorage.language ? localStorage.language : 'en',
      darkmode: localStorage && localStorage.darkmode ? localStorage.darkmode : 'manual',
    },
  });

  // create a tar with the copied files
  await tar.c(
    {
      portable: true,
      gzip: true,
      file: backupPath,
      cwd: backupDirectory,
      filter: (filePath, stat) => {
        if (stat.size > 5e7) {
          log.warn(`Backup is skipping "${filePath}" because it is larger than 50MB.`, 'Interface', 'interface');
          return false;
        }
        return true;
      },
    },
    ['database', 'recordings', 'info.json']
  );

  return {
    backupDirectory,
    backupPath,
    backupFileName,
  };
};

export const restoreBackup = async (file) => {
  const recordingsPath = await Database.interfaceDB.chain
    .get('settings')
    .get('recordings')
    .get('path')
    .cloneDeep()
    .value();

  const backupDirectory = file.destination;
  const backupFileName = file.filename; // eslint-disable-line no-unused-vars
  const backupPath = file.path;

  log.info('Starting backup restore...');

  // extract the tar
  await tar.x({
    cwd: backupDirectory,
    file: backupPath,
  });

  const infoFile = await fs.readJSON(`${backupDirectory}/info.json`);

  // move the content to desired directories
  await fs.move(backupDirectory + '/database', ConfigService.databasePath, { overwrite: true });
  await fs.move(backupDirectory + '/recordings', recordingsPath, { overwrite: true });

  // remove tmp
  log.debug('Removing unnecessary files...');
  await fs.remove(backupDirectory);

  // refresh db
  await Database.interfaceDB.read();
  await Database.refreshRecordingsDatabase();

  log.info('Backup was successfully restored');

  return infoFile.localStorage;
};

export const removeBackup = async (backup) => {
  log.info(`Removing temporary backup directory at ${backup.backupDirectory}`);
  return await fs.remove(backup.backupDirectory);
};
