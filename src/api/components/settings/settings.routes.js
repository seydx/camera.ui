'use-strict';

import * as SettingsController from './settings.controller.js';

import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Settings
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/settings:
   *   get:
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     summary: Get interface settings
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/settings', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('settings:access'),
    SettingsController.show,
  ]);

  /**
   * @swagger
   * /api/settings/{target}:
   *   get:
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     summary: Get specific interface setting
   *     parameters:
   *       - in: path
   *         name: target
   *         schema:
   *           type: string
   *         required: true
   *         description: Settings target
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
  app.get('/api/settings/:target', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('settings:access'),
    SettingsController.getTarget,
  ]);

  /**
   * @swagger
   * /api/settings/{target}:
   *   patch:
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     summary: Change target settings
   *     parameters:
   *       - in: path
   *         name: target
   *         schema:
   *           type: string
   *         required: true
   *         description: Settings target
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
  app.patch('/api/settings/:target', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('settings:edit'),
    SettingsController.patchTarget,
  ]);

  /**
   * @swagger
   * /api/settings/reset:
   *   put:
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     summary: Reset interface settings
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.put('/api/settings/reset', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('admin'),
    SettingsController.reset,
  ]);
};
