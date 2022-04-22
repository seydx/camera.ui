'use-strict';

import App from '../../src/api/app.js';
import Database from '../../src/api/database.js';

const app = new App({
  debug: process.env.CUI_LOG_MODE === '2',
  version: process.env.CUI_MODULE_VERSION,
});

import supertest from 'supertest';
const request = supertest(app);

const userCredentials = {
  username: 'user',
  password: 'test',
  permissionLevel: ['users:access'],
};

const masterCredentials = {
  username: 'master',
  password: 'master',
  permissionLevel: ['admin'],
};

const masterCredentials2 = {
  username: 'master2',
  password: 'test',
  permissionLevel: ['admin'],
};

beforeAll(async () => {
  const database = new Database();
  await database.prepareDatabase();
  await Database.resetDatabase();
  await database.prepareDatabase();
});

describe('POST /api/users', () => {
  it('should create a new user with low permission level', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .post('/api/users')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send(userCredentials);
    expect(response.statusCode).toBe(201);
  });

  it('should fail if a required field is missing', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .post('/api/users')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ name: 'test' });
    expect(response.statusCode).toBe(422);
  });

  it('should fail if a user with same username exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .post('/api/users')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send(masterCredentials);
    expect(response.statusCode).toBe(409);
  });

  it('should fail if a user with ADMIN permisson level already exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .post('/api/users')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send(masterCredentials2);
    expect(response.statusCode).toBe(409);
  });
});

describe('GET /api/users', () => {
  it('should response with JSON array of all registered users', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/users').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.result)).toBe(true);
  });
});

describe('GET /api/users/:name', () => {
  it('should fail if user dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/users/lulz').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should response with JSON object of the user', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .get('/api/users/' + masterCredentials.username)
      .auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body).length).toBeTruthy();
  });
});

describe('PATCH /api/users/:name', () => {
  it('should fail if user dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .patch('/api/users/lulz')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ photo: '/images/user/admin.png' });
    expect(response.statusCode).toBe(404);
  });

  it('should fail if body is undefined', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .patch('/api/users/' + masterCredentials.username)
      .auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(400);
  });

  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .patch('/api/users/' + masterCredentials.username)
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ photo: '/images/user/admin.png' });
    expect(response.statusCode).toBe(204);
  });
});

describe('DELETE /api/users/:name', () => {
  it('should fail if user dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.delete('/api/users/lulz').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should fail if user has ADMIN permission', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .delete('/api/users/' + masterCredentials.username)
      .auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(409);
  });

  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .delete('/api/users/' + userCredentials.username)
      .auth(auth.body.access_token, { type: 'bearer' });

    expect(response.statusCode).toBe(204);
  });
});
