'use-strict';

import * as UsersController from './users.controller.js';

import * as PaginationMiddleware from '../../middlewares/pagination.middleware.js';
import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';
import * as UserValidationMiddleware from '../../middlewares/user.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Users
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/users:
   *   get:
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     summary: Get all users
   *     parameters:
   *       - in: query
   *         name: start
   *         schema:
   *           type: number
   *         description: Start index
   *       - in: query
   *         name: page
   *         schema:
   *           type: number
   *         description: Page
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: number
   *         description: Page size
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/users', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('users:access'),
    UsersController.list,
    PaginationMiddleware.pages,
  ]);

  /**
   * @swagger
   * /api/users:
   *   post:
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     summary: Creates new user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *          schema:
   *            type: object
   *            properties:
   *              username:
   *                type: string
   *              password:
   *                type: string
   *              permissionLevel:
   *                type: object
   *     responses:
   *       201:
   *         description: Successfull
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   *       409:
   *         description: User already exists
   *       500:
   *         description: Internal server error
   */
  app.post('/api/users', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('admin'),
    UserValidationMiddleware.hasValidFields,
    UsersController.insert,
  ]);

  /**
   * @swagger
   * /api/users/{name}:
   *   get:
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     summary: Get specific user by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the user
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
  app.get('/api/users/:name', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.onlySameUserOrAdminCanDoThisAction,
    UsersController.getByName,
  ]);

  /**
   * @swagger
   * /api/users/{name}:
   *   patch:
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     summary: Change user credentials by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the user
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
  app.patch(
    '/api/users/:name',
    /*upload.single('photo'), */ [
      ValidationMiddleware.validJWTNeeded,
      PermissionMiddleware.onlySameUserOrAdminCanDoThisAction,
      UsersController.patchByName,
    ]
  );

  /**
   * @swagger
   * /api/users/{name}:
   *   delete:
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     summary: Delete user by name
   *     parameters:
   *       - in: path
   *         name: name
   *         schema:
   *           type: string
   *         required: true
   *         description: Name of the user
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
  app.delete('/api/users/:name', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('admin'),
    UsersController.removeByName,
  ]);
};
