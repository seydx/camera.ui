'use-strict';

import * as SystemController from './system.controller.js';

import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: System
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/system/log:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get DB file info
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/db', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.lastModifiedDb,
  ]);

  /**
   * @swagger
   * /api/system/db/download:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get database.json
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/db/download', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.downloadDb,
  ]);

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
   * /api/system/disk:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get system disk load
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/disk', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.getDiskLoad,
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
   * /api/system/http/status:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get HTTP server status
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/http/status', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.getHttpServerStatus,
  ]);

  /**
   * @swagger
   * /api/system/http/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart HTTP server
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
   * /api/system/http/stop:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Stop HTTP server
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/http/stop', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.stopHttpServer,
  ]);

  /**
   * @swagger
   * /api/system/smtp/status:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get SMTP server status
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/smtp/status', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.getSmtpServerStatus,
  ]);

  /**
   * @swagger
   * /api/system/smtp/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart SMTP server
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
   * /api/system/smtp/stop:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Stop SMTP server
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/smtp/stop', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.stopSmtpServer,
  ]);

  /**
   * @swagger
   * /api/system/ftp/status:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get FTP server status
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/ftp/status', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.getFtpServerStatus,
  ]);

  /**
   * @swagger
   * /api/system/ftp/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart FTP server
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/ftp/restart', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.restartFtpServer,
  ]);

  /**
   * @swagger
   * /api/system/ftp/stop:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Stop FTP server
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/ftp/stop', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.stopFtpServer,
  ]);

  /**
   * @swagger
   * /api/system/mqtt/status:
   *   get:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Get MQTT server status
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/system/mqtt/status', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.getMqttClientStatus,
  ]);

  /**
   * @swagger
   * /api/system/mqtt/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart MQTT client
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/mqtt/restart', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.restartMqttClient,
  ]);

  /**
   * @swagger
   * /api/system/mqtt/stop:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Stop MQTT client
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/system/mqtt/stop', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.stopMqttClient,
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
  app.get('/api/system/uptime', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    SystemController.getUptime,
  ]);
};
