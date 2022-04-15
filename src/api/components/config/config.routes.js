'use-strict';

import * as ConfigController from './config.controller.js';

import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Config
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/config:
   *   get:
   *     tags: [Config]
   *     security:
   *       - bearerAuth: []
   *     summary: Get interface/plugin config
   *     parameters:
   *       - in: query
   *         name: target
   *         schema:
   *           type: string
   *         description: Target config (ui | plugin | all)
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */

  app.get('/api/config', [ValidationMiddleware.validJWTOptional, ConfigController.show]);

  /**
   * @swagger
   * /api/system/config/download:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get config.json
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/config/download', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    ConfigController.downloadConfig,
  ]);

  /**
   * @swagger
   * /api/config/stat:
   *   get:
   *     tags: [Config]
   *     security:
   *       - bearerAuth: []
   *     summary: Get Config file info
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/config/stat', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    ConfigController.lastModifiedConfig,
  ]);

  /**
   * @swagger
   * /api/config/{target}:
   *   get:
   *     tags: [Config]
   *     security:
   *       - bearerAuth: []
   *     summary: Get specific config setting
   *     parameters:
   *       - in: path
   *         name: target
   *         schema:
   *           type: string
   *         required: true
   *         description: Config target
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Not found
   *       500:
   *         description: Internal server error
   */
  app.patch('/api/config', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    ConfigController.patchConfig,
  ]);
};
