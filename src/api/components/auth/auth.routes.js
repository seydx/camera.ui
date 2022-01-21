'use-strict';
import * as AuthController from './auth.controller.js';

import * as AuthValidationMiddleware from '../../middlewares/auth.validation.middleware.js';
import * as UserValidationMiddleware from '../../middlewares/user.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Authentication
 */

export const routesConfig = (app) => {
  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     tags: [Authentication]
   *     summary: Logs in a user
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
   *     responses:
   *       201:
   *         description: User found and logged in successfully
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized (Bad username/password or token expired/invalid)
   *       403:
   *         description: Forbidden (User not found)
   *       422:
   *         description: Username and/or password not given
   *       500:
   *         description: Internal server error
   */
  app.post('/api/auth/login', [
    UserValidationMiddleware.hasAuthValidFields,
    UserValidationMiddleware.isPasswordAndUserMatch,
    AuthController.login,
  ]);

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     summary: Logs out a user
   *     responses:
   *       200:
   *         description: Logged out successfully
   *       500:
   *         description: Internal server error
   */
  app.post('/api/auth/logout', [AuthController.logout]);

  /**
   * @swagger
   * /api/auth/check:
   *   get:
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     summary: Checks user token status
   *     responses:
   *       200:
   *         description: Status OK
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/auth/check', [AuthValidationMiddleware.validJWTNeeded, AuthController.check]);
};
