'use-strict';

import App from '../../src/api/app.js';
import Database from '../../src/api/database.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = new App({
  debug: process.env.CUI_LOG_MODE === '2',
  version: process.env.CUI_MODULE_VERSION,
});

import fs from 'fs-extra';
import path from 'path';
import supertest from 'supertest';

const request = supertest(app);

const masterCredentials = {
  username: 'master',
  password: 'master',
};

beforeAll(async () => {
  const database = new Database();
  await database.prepareDatabase();
  await Database.resetDatabase();
  await database.prepareDatabase();

  Database.recordingsDB.chain
    .get('recordings')
    .remove(() => true)
    .value(); // eslint-disable-line no-unused-vars

  let recPath = Database.recordingsDB.chain.get('path').value();
  await fs.emptyDir(recPath);

  let files = [
    'Yi_Dome-48171187ca-1616771136_m_CUI.mp4',
    'Yi_Dome-48171187ca-1616771136_m@2_CUI.jpeg',
    'Yi_Dome-c45647fbdf-1619771202_m_CUI.jpeg',
  ];

  for (const file of files) {
    await fs.ensureFile(recPath + '/' + file);
  }
});

describe('GET /api/backup/download', () => {
  // eslint-disable-next-line jest/no-done-callback
  it('should response if successfull', (done) => {
    const backupFileName = 'cameraui-backup.tar.gz';

    const backupDirectory = path.resolve(__dirname, '..', 'camera.ui');
    const backupPath = path.resolve(backupDirectory, backupFileName);

    const file = fs.createWriteStream(backupPath);

    request
      .post('/api/auth/login')
      .send(masterCredentials)
      .then((auth) => {
        expect(auth.statusCode).toBe(201);

        request
          .get('/api/backup/download')
          .auth(auth.body.access_token, { type: 'bearer' })
          .expect(200)
          .pipe(file)
          .on('finish', () => done());
      });
  });
});

describe('POST /api/backup/restore', () => {
  it('should response if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    //restore from created backup file
    const backupFileName = 'cameraui-backup.tar.gz';
    const backupDirectory = path.resolve(__dirname, '..', 'camera.ui');
    const backupPath = path.resolve(backupDirectory, backupFileName);

    const response = await request
      .post('/api/backup/restore')
      .auth(auth.body.access_token, { type: 'bearer' })
      .field('name', backupFileName)
      .attach('file', backupPath);

    expect(response.statusCode).toBe(201);
  });
});
