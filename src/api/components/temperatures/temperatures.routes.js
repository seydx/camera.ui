'use-strict';

import * as TemperaturesController from './temperatures.controller.js';

import * as PaginationMiddleware from '../../middlewares/pagination.middleware.js';
import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Temperatures
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/temperatures:
   *   get:
   *     tags: [Temperatures]
   *     security:
   *       - bearerAuth: []
   *     summary: Get all temperatures
   *     parameters:
   *       - in: query
   *         name: cameraName
   *         description: Camera Name
   *         example: "Camera One,Camera Two"
   *         type: string
   *       - in: query
   *         name: region
   *         description: region
   *         example: "2,3"
   *         type: string
   *       - in: query
   *         name: preset
   *         description: Preset
   *         example: "4,5"
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
  app.get('/api/temperatures', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:access'),
    TemperaturesController.list,
    PaginationMiddleware.pages,
  ]);

  /**
   * @swagger
   * /api/temperatures:
   *   post:
   *     tags: [Temperatures]
   *     security:
   *       - bearerAuth: []
   *     summary: Creates new temperature
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *          schema:
   *            type: object
   *            properties:
   *              cameraName:
   *                type: string
   *              preset:
   *                type: string
   *              region:
   *                type: string
   *              minTemp:
   *                type: string
   *              maxTemp:
   *                type: string
   *              avgTemp:
   *                type: string
   *     responses:
   *       201:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.post('/api/temperatures', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:edit'),
    TemperaturesController.insert,
  ]);

  /**
   * @swagger
   * /api/temperatures:
   *   delete:
   *     tags: [Temperatures]
   *     security:
   *       - bearerAuth: []
   *     summary: Remove all temperatures
   *     responses:
   *       204:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.delete('/api/temperatures', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:edit'),
    TemperaturesController.removeAll,
  ]);

  /**
   * @swagger
   * /api/temperatures/{id}:
   *   get:
   *     tags: [Temperatures]
   *     security:
   *       - bearerAuth: []
   *     summary: Get specific temperatures by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the temperature
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
  app.get('/api/temperatures/:id', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:access'),
    TemperaturesController.getById,
  ]);

  /**
   * @swagger
   * /api/temperatures/{id}:
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
   *         description: ID of the temperatures
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
  app.delete('/api/temperatures/:id', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('notifications:edit'),
    TemperaturesController.removeById,
  ]);
};
