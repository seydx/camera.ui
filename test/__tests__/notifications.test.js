'use-strict';

import App from '../../src/api/app.js';
import Database from '../../src/api/database.js';

const app = new App({
  debug: process.env.CUI_LOG_MODE === '2',
  version: process.env.CUI_MODULE_VERSION,
});

import supertest from 'supertest';
const request = supertest(app);

let notificationId;

const camera = {
  name: 'Test Camera',
  videoConfig: {
    source: 'test',
  },
};

const masterCredentials = {
  username: 'master',
  password: 'master',
};

beforeAll(async () => {
  const database = new Database();
  await database.prepareDatabase();
  await Database.resetDatabase();
  await database.prepareDatabase();

  let cameraExist = await Database.interfaceDB.chain.get('cameras').find({ name: 'Test Camera' }).value();

  if (!cameraExist) {
    await Database.interfaceDB.chain.get('cameras').push(camera).value();
  }
});

describe('GET /api/notifications', () => {
  it('should response with JSON array of all registered notifications', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/notifications').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.result)).toBe(true);
  });
});

describe('POST /api/notifications', () => {
  it('should fail if a required field is missing', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const notification = {
      //camera: 'Test Camera',
      recordType: 'Snapshot',
      trigger: 'motion',
    };

    const response = await request
      .post('/api/notifications')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send(notification);
    expect(response.statusCode).toBe(422);
  });

  it('should create a new notification', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const notification = {
      camera: 'Test Camera',
      type: 'Snapshot',
      trigger: 'motion',
    };

    const response = await request
      .post('/api/notifications')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send(notification);
    expect(response.statusCode).toBe(201);

    notificationId = response.body.notification.id;
  });
});

describe('GET /api/notifications/:id', () => {
  it('should fail if notification dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/notifications/1337').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should response with JSON object of the notification', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .get('/api/notifications/' + notificationId)
      .auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body).length).toBeTruthy();
  });
});

describe('DELETE /api/notifications/:id', () => {
  it('should fail if notification dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.delete('/api/notifications/1337').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .delete('/api/notifications/' + notificationId)
      .auth(auth.body.access_token, { type: 'bearer' });

    expect(response.statusCode).toBe(204);
  });
});

describe('DELETE /api/notifications', () => {
  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.delete('/api/notifications').auth(auth.body.access_token, { type: 'bearer' });

    expect(response.statusCode).toBe(204);
  });
});
