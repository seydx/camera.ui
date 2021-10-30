'use-strict';

const ConfigController = require('./config.controller');

const PermissionMiddleware = require('../../middlewares/auth.permission.middleware');
const ValidationMiddleware = require('../../middlewares/auth.validation.middleware');

/**
 * @swagger
 * tags:
 *  name: Config
 */

exports.routesConfig = (app) => {
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
  app.get('/api/config/:target', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    ConfigController.getTarget,
  ]);

  /**
   * @swagger
   * /api/config/{target}:
   *   patch:
   *     tags: [Config]
   *     security:
   *       - bearerAuth: []
   *     summary: Change target config
   *     parameters:
   *       - in: path
   *         name: target
   *         schema:
   *           type: string
   *         required: true
   *         description: Config target
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *          schema:
   *            type: object
   *     responses:
   *       200:
   *         description: Successfull
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Not found
   *       500:
   *         description: Internal server error
   */
  app.patch('/api/config/:target', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    ConfigController.patchTarget,
  ]);
};
