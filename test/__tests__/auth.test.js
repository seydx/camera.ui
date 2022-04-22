'use-strict';

import App from '../../src/api/app.js';
import Database from '../../src/api/database.js';

const app = new App({
  debug: process.env.CUI_LOG_MODE === '2',
  version: process.env.CUI_MODULE_VERSION,
});

import supertest from 'supertest';
const request = supertest(app);

let token;

const user = {
  id: 'b5d76220-986d-4d96-8612-24eab4a9e3f0',
  username: 'user',
  password:
    '5UAbVs2gQBoasU8rgwXoUA==$F/zGXi4Zxg0vhqpdTlRBJAx9mC4GhdjjCAddj+qjL2A/RWvzvCG14+o3Q/62vzBUbXz0cpG0wdjGGjaUa3QvIw==',
  photo: '/images/user/anonym.png',
  permissionLevel: ['users:access'],
};

const userCredentials = {
  username: 'user',
  password: 'test',
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

  await Database.interfaceDB.chain.get('users').push(user).value();
});

describe('Authentication', () => {
  it('should fail if name or password is empty', async () => {
    const auth = await request.post('/api/auth/login').send({ name: 'user' });
    expect(auth.statusCode).toBe(422);
  });

  it('should response after successfull login with token', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);
  });

  it('should response after successfull logout', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    token = auth.body.access_token;

    const response = await request.post('/api/auth/logout').auth(token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
  });
});

describe('Check authentication', () => {
  it('should fail if token not given', async () => {
    const response = await request.get('/api/auth/check');
    expect(response.statusCode).toBe(401);
  });

  it('should fail if token is expired/invalid/blacklisted', async () => {
    const response = await request.get('/api/auth/check').auth(token, { type: 'bearer' });
    expect(response.statusCode).toBe(401);
  });

  it('should response with status OK if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/auth/check').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
  });
});

describe('GET endpoint with a heigher permission level', () => {
  it('should require authorization', async () => {
    const response = await request.get('/api/users');
    expect(response.statusCode).toBe(401);
  });

  it('should fail if permission level is lower than required', async () => {
    const auth = await request.post('/api/auth/login').send(userCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/notifications').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(403);
  });

  it('should response if permission level is greater or equal than required', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/users').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.result)).toBe(true);
  });
});
