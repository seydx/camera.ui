'use-strict';

import App from '../../src/api/app.js';
import Database from '../../src/api/database.js';

const app = new App({
  debug: process.env.CUI_LOG_MODE === '2',
  version: process.env.CUI_MODULE_VERSION,
});

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
});

describe('GET /api/settings', () => {
  it('should response with JSON object', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/settings').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body).length).toBeTruthy();
  });
});

describe('GET /api/settings/:target', () => {
  it('should fail if target not found', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/settings/lulz').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should response with JSON object of target', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/settings/general').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body).length).toBeTruthy();
  });
});

describe('PATCH /api/settings/:target', () => {
  it('should fail if target not found', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .patch('/api/settings/lulz')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ atHome: true });
    expect(response.statusCode).toBe(404);
  });

  it('should fail if body is undefined', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.patch('/api/settings/general').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(400);
  });

  it('should response if target updated successfully', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .patch('/api/settings/general')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ atHome: true });
    expect(response.statusCode).toBe(204);
  });
});

describe('PUT /api/settings', () => {
  it('should response if db has been successfully resetted', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.put('/api/settings/reset').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(204);
  });
});
