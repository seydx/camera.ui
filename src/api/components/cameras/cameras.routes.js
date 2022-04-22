'use-strict';

import * as CamerasController from './cameras.controller.js';

import * as PaginationMiddleware from '../../middlewares/pagination.middleware.js';
import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';
import * as CamerasValidationMiddleware from '../../middlewares/cameras.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Cameras
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/cameras:
   *   get:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Get all cameras
   *     parameters:
   *       - in: query
   *         name: cameras
   *         description: Cameras
   *         example: "Camera One,Camera Two"
   *         type: string
   *       - in: query
   *         name: status
   *         description: Status
   *         example: "Online,Offline"
   *         type: string
   *       - in: query
   *         name: start
   *         type: number
   *         description: Start index
   *       - in: query
   *         name: page
   *         type: number
   *         description: Page
   *       - in: query
   *         name: pageSize
   *         type: number
   *         description: Page size
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/cameras', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:access'),
    CamerasController.list,
    PaginationMiddleware.pages,
  ]);

  /**
   * @swagger
   * /api/cameras:
   *   post:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Creates new camera
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *          schema:
   *            type: object
   *            properties:
   *              name:
   *                type: string
   *              videoConfig:
   *                type: object
   *                properties:
   *                  source:
   *                    type: string
   *     responses:
   *       201:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       409:
   *         description: Camera already exists
   *       500:
   *         description: Internal server error
   */
  app.post('/api/cameras', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:edit'),
    CamerasValidationMiddleware.hasValidFields,
    CamerasController.insert,
  ]);

  /**
   * @swagger
   * /api/cameras:
   *   delete:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Remove all cameras from config/ui
   *     responses:
   *       204:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.delete('/api/cameras', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:edit'),
    CamerasController.removeAll,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}:
   *   get:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Get specific camera by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the camera
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
  app.get('/api/cameras/:name/feed', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:access'),
    CamerasController.getByName,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}:
   *   get:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Get specific camera by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the camera
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
  app.get('/api/cameras/:name', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:access'),
    CamerasController.getByName,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}:
   *   patch:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Change camera config by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the camera
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
  app.patch('/api/cameras/:name', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:edit'),
    CamerasController.patchByName,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}:
   *   delete:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Delete camera by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the camera
   *     responses:
   *       200:
   *         description: Successfull
   *       400:
   *         description: Bad request
   *       404:
   *         description: Not found
   *       500:
   *         description: Internal server error
   */
  app.delete('/api/cameras/:name', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:edit'),
    CamerasController.removeByName,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/settings:
   *   get:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Get camera settings
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the camera
   *       - in: query
   *         name: buffer
   *         schema:
   *           type: boolean
   *         description: Returns camera settings
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
  app.get('/api/cameras/:name/settings', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:access'),
    CamerasController.getCameraSettingsByName,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/snapshot:
   *   get:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Get camera snapshot by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the camera
   *       - in: query
   *         name: buffer
   *         schema:
   *           type: boolean
   *         description: Returns a buffer of the snapshot
   *       - in: query
   *         name: fromSubSource
   *         schema:
   *           type: boolean
   *         description: Get snapshot from sub source
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
  app.get('/api/cameras/:name/snapshot', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:access'),
    CamerasController.getSnapshotByName,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/status:
   *   get:
   *     tags: [Cameras]
   *     security:
   *       - bearerAuth: []
   *     summary: Get camera status by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the camera
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
  app.get('/api/cameras/:name/status', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('cameras:access'),
    CamerasController.getStatusByName,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/prebuffering/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart Camera Prebuffering
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/cameras/:name/prebuffering/restart', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    CamerasController.restartPrebuffering,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/prebuffering/stop:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Stop Camera Prebuffering
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/cameras/:name/prebuffering/stop', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    CamerasController.stopPrebuffering,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/videoanalysis/restart:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Restart Camera Videoanalysis
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/cameras/:name/videoanalysis/restart', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    CamerasController.restartVideoanalysis,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/videoanalysis/stop:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Stop Camera Videoanalysis
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/cameras/:name/videoanalysis/stop', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    CamerasController.stopVideoanalysis,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/motion/start:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Trigger motion
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/cameras/:name/motion/start', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    CamerasController.startMotion,
  ]);

  /**
   * @swagger
   * /api/cameras/{name}/motion/reset:
   *   put:
   *     tags: [System]
   *     security:
   *       - bearerAuth: []
   *     summary: Reset motion
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/cameras/:name/motion/reset', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlyMasterCanDoThisAction,
    CamerasController.resetMotion,
  ]);
};
