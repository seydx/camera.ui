'use-strict';

import * as SubscribeController from './subscribe.controller.js';

export const routesConfig = (app) => {
  app.get('/api/subscribe', [SubscribeController.getKeys]);
  app.post('/api/subscribe', [SubscribeController.subscribe]);
};
