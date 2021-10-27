'use-strict';

const FilesController = require('./files.controller');

//const PermissionMiddleware = require('../../middlewares/auth.permission.middleware');
//const ValidationMiddleware = require('../../middlewares/auth.validation.middleware');

exports.routesConfig = (app) => {
  app.get('/files/:file', [
    //ValidationMiddleware.validJWTNeeded,
    //PermissionMiddleware.minimumPermissionLevelRequired('recordings:access'),
    FilesController.serve,
  ]);
};
