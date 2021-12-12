'use-strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const tar = require('tar');

const { ConfigService } = require('../../../services/config/config.service');
const { LoggerService } = require('../../../services/logger/logger.service');

const { Database } = require('../../database');

const { log } = LoggerService;

exports.createBackup = async (localStorage) => {
  await Database.interfaceDB.read();

  const recordingsPath = await Database.interfaceDB.get('settings').get('recordings').get('path').value();
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
    firstStart: await Database.interfaceDB.get('firstStart').value(),
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

exports.restoreBackup = async (file) => {
  await Database.interfaceDB.read();

  const recordingsPath = await Database.interfaceDB.get('settings').get('recordings').get('path').value();
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
  await Database.refreshDatabase();
  await Database.refreshRecordingsDatabase();

  log.info('Backup was successfully restored');

  return infoFile.localStorage;
};

exports.removeBackup = async (backup) => {
  log.info(`Removing temporary backup directory at ${backup.backupDirectory}`);
  return await fs.remove(backup.backupDirectory);
};
