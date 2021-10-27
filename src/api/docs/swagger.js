'use-strict';

const { version } = require('../../../package.json');

module.exports = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'camera.ui API',
      description: '',
      version: version,
      contact: {
        name: 'camera.ui',
        url: 'https://github.com/SeydX/camera.ui',
      },
    },
    tags: [],
    servers: [],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'oauth2',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          flows: {
            password: {
              tokenUrl: '/api/auth/login',
              scopes: null,
            },
          },
        },
      },
    },
  },
  apis: [`${__dirname}/components/**/*.routes.js`],
};
