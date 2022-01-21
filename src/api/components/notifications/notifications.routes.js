'use-strict';

import * as NotificationsController from './notifications.controller.js';

import * as PaginationMiddleware from '../../middlewares/pagination.middleware.js';
import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';
import * as NotificationsValidationMiddleware from '../../middlewares/notifications.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Notifications
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/notifications:
   *   get:
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     summary: Get all notifications
   *     parameters:
   *       - in: query
   *         name: cameras
   *         description: Cameras
   *         example: "Camera One,Camera Two"
   *         type: string
   *       - in: query
   *         name: labels
   *         description: Labels
   *         example: "Human,Person,Face"
   *         type: string
   *       - in: query
   *         name: type
   *         description: Type
   *         example: "Snapshot,Video"
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
   *       - in: query
   *         name: from
   *         description: Start Date
   *         example: "2020-01-01"
   *         format: date
   *         pattern: "YYYY-MM-DD"
   *         minLength: 0
   *         maxLength: 10
   *       - in: query
   *         name: to
   *         description: End Date
   *         example: "2020-02-01"
   *         format: date
   *         pattern: "YYYY-MM-DD"
   *         minLength: 0
   *         maxLength: 10
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/notifications', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:access'),
    NotificationsController.list,
    PaginationMiddleware.pages,
  ]);

  /**
   * @swagger
   * /api/notifications:
   *   post:
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     summary: Creates new notification
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *          schema:
   *            type: object
   *            properties:
   *              camera:
   *                type: string
   *              trigger:
   *                type: string
   *     responses:
   *       201:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.post('/api/notifications', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:edit'),
    NotificationsValidationMiddleware.hasValidFields,
    NotificationsController.insert,
  ]);

  /**
   * @swagger
   * /api/notifications:
   *   delete:
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     summary: Remove all notifications
   *     responses:
   *       204:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.delete('/api/notifications', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:edit'),
    NotificationsController.removeAll,
  ]);

  /**
   * @swagger
   * /api/notifications/{id}:
   *   get:
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     summary: Get specific notifications by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the notification
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
  app.get('/api/notifications/:id', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:access'),
    NotificationsController.getById,
  ]);

  /**
   * @swagger
   * /api/notifications/{id}:
   *   delete:
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     summary: Delete notification by id
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the notifications
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
  app.delete('/api/notifications/:id', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:edit'),
    NotificationsController.removeById,
  ]);
};
