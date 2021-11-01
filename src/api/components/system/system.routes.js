'use-strict';

const SystemController = require('./system.controller');

const PermissionMiddleware = require('../../middlewares/auth.permission.middleware');
const ValidationMiddleware = require('../../middlewares/auth.validation.middleware');

/**
 * @swagger
 * tags:
 *  name: System
 */

exports.routesConfig = (app) => {
  /**
   * @swagger
   * /api/system:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart system
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */

  app.get('/api/system/restart', [
    ValidationMiddleware.validJWTOptional,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.restartSystem,
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
  app.get('/api/system/update', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.updateSystem,
  ]);
};
