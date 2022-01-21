'use-strict';

import * as FilesController from './files.controller.js';

//import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware'
//import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware'

export const routesConfig = (app) => {
  app.get('/files/:file', [
    //ValidationMiddleware.validJWTNeeded,
    //PermissionMiddleware.minimumPermissionLevelRequired('recordings:access'),
    FilesController.serve,
  ]);
};
