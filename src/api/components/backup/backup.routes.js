'use-strict';

import * as BackupController from './backup.controller.js';

import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: Backup
 */

export const routesConfig = (app, upload) => {
  /**
   * @swagger
   * /api/backup/download:
   *   get:
   *     tags: [Backup]
   *     security:
   *       - bearerAuth: []
   *     summary: Download backup
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.get('/api/backup/download', [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('backup:download'),
    BackupController.download,
  ]);

  /**
   * @swagger
   * /api/backup/restore:
   *   post:
   *     tags: [Backup]
   *     security:
   *       - bearerAuth: []
   *     summary: Restore backup
   *     responses:
   *       200:
   *         description: Successfull
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  app.post('/api/backup/restore', upload.single('file'), [
    ValidationMiddleware.validJWTNeeded,
    PermissionMiddleware.minimumPermissionLevelRequired('backup:restore'),
    BackupController.restore,
  ]);
};
