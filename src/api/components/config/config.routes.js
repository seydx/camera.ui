'use-strict';

const ConfigController = require('./config.controller');

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
};
