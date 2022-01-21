'use-strict';

import * as RecordingsController from './recordings.controller.js';

import * as PaginationMiddleware from '../../middlewares/pagination.middleware.js';
import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';
import * as RecordingsValidationMiddleware from '../../middlewares/recordings.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Recordings
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/recordings:
   *   get:
   *     tags: [Recordings]
   *     security:
   *       - bearerAuth: []
   *     summary: Get all recordings
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
  app.get('/api/recordings', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('recordings:access'),
    RecordingsController.list,
    PaginationMiddleware.pages,
  ]);

  /**
   * @swagger
   * /api/recordings:
   *   post:
   *     tags: [Recordings]
   *     security:
   *       - bearerAuth: []
   *     summary: Creates new recording
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
   *              type:
   *                type: string
   *     responses:
   *       201:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.post('/api/recordings', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:edit'),
    RecordingsValidationMiddleware.hasValidFields,
    RecordingsController.insert,
  ]);

  /**
   * @swagger
   * /api/recordings:
   *   delete:
   *     tags: [Recordings]
   *     security:
   *       - bearerAuth: []
   *     summary: Remove all recordings
   *     responses:
   *       204:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.delete('/api/recordings', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('recordings:edit'),
    RecordingsController.removeAll,
  ]);

  /**
   * @swagger
   * /api/recordings/{id}:
   *   get:
   *     tags: [Recordings]
   *     security:
   *       - bearerAuth: []
   *     summary: Get specific recording by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the recording
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
  app.get('/api/recordings/:id', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('recordings:access'),
    RecordingsController.getById,
  ]);

  /**
   * @swagger
   * /api/recordings/{id}:
   *   delete:
   *     tags: [Recordings]
   *     security:
   *       - bearerAuth: []
   *     summary: Delete recording by id
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the recordings
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
  app.delete('/api/recordings/:id', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('recordings:edit'),
    RecordingsController.removeById,
  ]);
};
