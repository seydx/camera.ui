'use-strict';

import App from '../../src/api/app.js';
import Database from '../../src/api/database.js';

const app = new App({
  debug: process.env.CUI_LOG_MODE === '2',
  version: process.env.CUI_MODULE_VERSION,
});

import fs from 'fs-extra';
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
    'Yi_Dome-48171187ca-1616771136_m_CUI@2.jpeg',
    'Yi_Dome-c45647fbdf-1619771202_m_CUI.jpeg',
  ];

  for (const file of files) {
    await fs.ensureFile(recPath + '/' + file);
  }

  await Database.refreshRecordingsDatabase();
});

describe('GET /api/recordings', () => {
  it('should response with JSON array of all registered recordings', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/recordings').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.result)).toBe(true);
  });
});

describe('GET /api/recordings/:id', () => {
  it('should fail if recording dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/recordings/1337').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should response with JSON object of the recording', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .get('/api/recordings/48171187ca')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ refresh: true });
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body).length).toBeTruthy();
  });
});

describe('DELETE /api/recordings/:id', () => {
  it('should fail if recording dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.delete('/api/recordings/1337').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .delete('/api/recordings/48171187ca')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ refresh: true });
    expect(response.statusCode).toBe(204);
  });
});

describe('DELETE /api/recordings', () => {
  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.delete('/api/recordings').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(204);
  });
});
