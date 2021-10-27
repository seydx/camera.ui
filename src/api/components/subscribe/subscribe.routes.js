'use-strict';

const SubscribeController = require('./subscribe.controller');

exports.routesConfig = (app) => {
  app.get('/api/subscribe', [SubscribeController.getKeys]);
  app.post('/api/subscribe', [SubscribeController.subscribe]);
};
