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
   * /api/system/log:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get truncated log
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/log', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.getLog,
  ]);

  /**
   * @swagger
   * /api/system/log:
   *   delete:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Clear log
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.delete('/api/system/log', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.clearLog,
  ]);

  /**
   * @swagger
   * /api/system/log/download:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get truncated log
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/log/download', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.downloadLog,
  ]);

  /**
   * @swagger
   * /api/system/changelog:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get camera.ui changelog
   *     parameters:
   *       - in: path
   *         name: version
   *         schema:
   *           type: string
   *         required: true
   *         description: Target package version
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/changelog', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.getChangelog,
  ]);

  /**
   * @swagger
   * /api/system/npm:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get npm package details
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/npm', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.fetchNpm,
  ]);

  /**
   * @swagger
   * /api/system/restart:
   *   put:
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
  app.put('/api/system/restart', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.restartSystem,
  ]);

  /**
   * @swagger
   * /api/system/http/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart http server
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/http/restart', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.restarHttpServer,
  ]);

  /**
   * @swagger
   * /api/system/smtp/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart smtp server
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/smtp/restart', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.restartSmtpServer,
  ]);

  /**
   * @swagger
   * /api/system/mqtt/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart mqtt client
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/http/restart', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.restartMqttClient,
  ]);

  /**
   * @swagger
   * /api/system/update:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Update system
   *     parameters:
   *       - in: path
   *         name: target
   *         schema:
   *           type: string
   *         required: true
   *         description: Target package version
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/update', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.updateSystem,
  ]);
};
