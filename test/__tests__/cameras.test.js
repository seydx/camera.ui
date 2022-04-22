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

describe('GET /api/cameras', () => {
  it('should response with JSON array of all registered cameras', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/cameras').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.result)).toBe(true);
  });
});

describe('POST /api/cameras', () => {
  it('should fail if a required field is missing', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const camera = {
      //"name": "Test Camera",
      videoConfig: {
        source: '-rtsp_transport udp -i rtsp://192.168.111.1/onvif1',
      },
    };

    const response = await request.post('/api/cameras').auth(auth.body.access_token, { type: 'bearer' }).send(camera);
    expect(response.statusCode).toBe(422);
  });

  it('should create a new camera', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const camera = {
      name: 'Test Camera 3',
      videoConfig: {
        source: '-rtsp_transport udp -i rtsp://192.168.111.1/onvif1',
      },
    };

    const response = await request.post('/api/cameras').auth(auth.body.access_token, { type: 'bearer' }).send(camera);

    expect(response.statusCode).toBe(201);
  });

  it('should fail if a camera with same name exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const camera = {
      name: 'Test Camera 3',
      videoConfig: {
        source: '-rtsp_transport udp -i rtsp://192.168.111.1/onvif1',
      },
    };

    const response = await request.post('/api/cameras').auth(auth.body.access_token, { type: 'bearer' }).send(camera);
    expect(response.statusCode).toBe(409);
  });
});

describe('GET /api/cameras/:name', () => {
  it('should fail if camera dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/cameras/Fail Camera').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should response with JSON object of the camera', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/cameras/Test Camera 3').auth(auth.body.access_token, { type: 'bearer' });

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body).length).toBeTruthy();
  });
});

describe('PATCH /api/cameras/:name', () => {
  it('should fail if camera dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .patch('/api/cameras/Fail Camera')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ manufacturer: 'camera.ui' });
    expect(response.statusCode).toBe(404);
  });

  it('should fail if body is undefined', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.patch('/api/cameras/Test Camera 3').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(400);
  });

  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .patch('/api/cameras/Test Camera 3')
      .auth(auth.body.access_token, { type: 'bearer' })
      .send({ manufacturer: 'camera.ui' });
    expect(response.statusCode).toBe(204);
  });
});

describe('DELETE /api/cameras/:name', () => {
  it('should fail if camera dont exists', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.delete('/api/cameras/Fail Camera').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(404);
  });

  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request
      .delete('/api/cameras/Test Camera 3')
      .auth(auth.body.access_token, { type: 'bearer' });

    expect(response.statusCode).toBe(204);
  });
});

describe('DELETE /api/cameras', () => {
  it('should response with no content if successfull', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.delete('/api/cameras').auth(auth.body.access_token, { type: 'bearer' });

    console.log(response.error);

    expect(response.statusCode).toBe(204);
  });
});
