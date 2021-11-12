const { App } = require('../../src/api/app');
const { Database } = require('../../src/api/database');

const app = App({
  debug: process.env.CUI_LOG_DEBUG === '1',
  version: require('../../package.json').version,
});

const supertest = require('supertest');
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

describe('GET /api/system', () => {
  it('should response with JSON object', async () => {
    const auth = await request.post('/api/auth/login').send(masterCredentials);
    expect(auth.statusCode).toBe(201);

    const response = await request.get('/api/config').auth(auth.body.access_token, { type: 'bearer' });
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body).length).toBeTruthy();
  });
});
