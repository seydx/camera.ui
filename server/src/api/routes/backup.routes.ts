import { BackupController } from '../controllers/backup.controller.js';
import { onlyAdminCanDoThisAction, onlySessionCanDoThisAction } from '../middlewares/authPermission.middleware.js';
import { validJWTNeeded } from '../middlewares/authValidation.middleware.js';
import { RESTORE_UPLOAD_CHUNK_SIZE } from '../../services/config/restore.js';
import {
  backupKeyBodySchema,
  confirmRestoreSchema,
  createMoveSchema,
  createRestoreUploadSchema,
  downloadBackupSchema,
  movePeerSchema,
  patchBackupSchedulerSettingsSchema,
  restorePluginSchema,
  restoreUploadParamsSchema,
  scheduledBackupParamsSchema,
  startMovePullSchema,
} from '../schemas/backup.schema.js';

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

export const BackupRoute: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const backupController = new BackupController(app);

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/download',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.download.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Create and download a backup archive',
      body: downloadBackupSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/jobs',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.startJob.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Start packing an encrypted backup, progress comes over the server socket and GET /backup/jobs',
      body: downloadBackupSchema,
    },
  });

  app.route({
    url: '/jobs',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.getJob.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'The running or last backup job, with a download link once it is done',
    },
  });

  app.route({
    url: '/key',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.getKey.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'The key that encrypts the backups of this server',
    },
  });

  app.route({
    url: '/key/confirm',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.confirmKey.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Note that the backup key is saved somewhere else',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/download/link',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.downloadLink.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Create a backup archive and return a single-use download link',
      body: downloadBackupSchema,
    },
  });

  app.route({
    url: '/restore',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.restore.bind(backupController),
    config: {
      uploadToDisk: true,
      multipartOptions: { limits: { fileSize: Infinity } },
    },
    schema: {
      tags: ['Backup'],
      summary: 'Stage a backup from an uploaded archive, it waits to be confirmed',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/uploads',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.createRestoreUpload.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Start a resumable upload of a backup archive',
      body: createRestoreUploadSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/uploads/:id',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.restoreUploadStatus.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'How much of a resumable upload has arrived',
      params: restoreUploadParamsSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/uploads/:id',
    method: 'PATCH',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.appendRestoreUpload.bind(backupController),
    bodyLimit: RESTORE_UPLOAD_CHUNK_SIZE + 1024 * 1024,
    schema: {
      tags: ['Backup'],
      summary: 'Append the next part of a resumable upload at the offset in the Upload-Offset header',
      params: restoreUploadParamsSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/uploads/:id/complete',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.completeRestoreUpload.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Stage a completely uploaded backup, it waits to be confirmed. An encrypted backup of another server needs its key',
      params: restoreUploadParamsSchema,
      body: backupKeyBodySchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/uploads/:id',
    method: 'DELETE',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.removeRestoreUpload.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Drop a resumable upload',
      params: restoreUploadParamsSchema,
    },
  });

  app.route({
    url: '/restore',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.getRestore.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'The last restore and the state before it that can be put back',
    },
  });

  app.route({
    url: '/restore/status',
    method: 'GET',
    handler: backupController.restoreStatus.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Progress of a running or recent restore, in full with the X-Restore-Ticket header',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/confirm',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.confirmRestore.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Apply the staged backup as a move or a copy, the server restarts for it',
      body: confirmRestoreSchema.optional(),
    },
  });

  app.route({
    url: '/restore',
    method: 'DELETE',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.cancelRestore.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Drop the staged backup',
    },
  });

  app.route({
    url: '/restore/undo',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.undoRestore.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Put back the state from before the last restore, the server restarts for it',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/plugins/retry',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.retryRestorePlugin.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Install a plugin from the restored backup again',
      body: restorePluginSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/plugins/discard',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.discardRestorePlugin.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Stop installing a plugin from the restored backup on every start',
      body: restorePluginSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/restore/move',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.startMovePull.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Fetch the backup of another server with its move code, it waits to be confirmed',
      body: startMovePullSchema,
    },
  });

  app.route({
    url: '/restore/move',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.movePullStatus.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Progress of fetching the backup of another server',
    },
  });

  app.route({
    url: '/restore/move',
    method: 'DELETE',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.cancelMovePull.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Stop fetching the backup of another server, that server runs again',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/move',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.createMove.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Create a one-time code another server uses to take this one over',
      body: createMoveSchema,
    },
  });

  app.route({
    url: '/move',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.moveStatus.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'State of the move of this server to another one',
    },
  });

  app.route({
    url: '/move',
    method: 'DELETE',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.cancelMove.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Withdraw the move code or let a server that moved run here again, it restarts for that',
    },
  });

  app.route({
    url: '/move/state',
    method: 'GET',
    handler: backupController.movedAwayState.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Whether this server stopped because it moved to another one',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/move/peer/check',
    method: 'POST',
    handler: backupController.movePeerCheck.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'For the new server: state of the move and the camera.ui version here',
      body: movePeerSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/move/peer/prepare',
    method: 'POST',
    handler: backupController.movePeerPrepare.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'For the new server: stop this server and pack its backup, it restarts for that',
      body: movePeerSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/move/peer/archive',
    method: 'POST',
    handler: backupController.movePeerArchive.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'For the new server: download the packed backup',
      body: movePeerSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/move/peer/received',
    method: 'POST',
    handler: backupController.movePeerReceived.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'For the new server: the whole backup arrived, this server stays stopped',
      body: movePeerSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/move/peer/abandon',
    method: 'POST',
    handler: backupController.movePeerAbandon.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'For the new server: it does not take over, this server runs again',
      body: movePeerSchema,
    },
  });

  app.route({
    url: '/scheduler',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.getScheduler.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Get backup scheduler settings and existing scheduled backups',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/scheduler',
    method: 'PATCH',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.patchScheduler.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Update backup scheduler settings',
      body: patchBackupSchedulerSettingsSchema,
    },
  });

  app.route({
    url: '/scheduler/run',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.runScheduler.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Run a scheduled backup immediately',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/scheduler/backups/:filename',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.downloadScheduledBackup.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Download a scheduled backup archive',
      params: scheduledBackupParamsSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/scheduler/backups/:filename/link',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.scheduledBackupDownloadLink.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Return a single-use download link for a scheduled backup archive',
      params: scheduledBackupParamsSchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/scheduler/backups/:filename/restore',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction, onlySessionCanDoThisAction],
    handler: backupController.restoreScheduledBackup.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Stage a scheduled backup archive, it waits to be confirmed',
      params: scheduledBackupParamsSchema,
      body: backupKeyBodySchema,
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/scheduler/backups/:filename',
    method: 'DELETE',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: backupController.deleteScheduledBackup.bind(backupController),
    schema: {
      tags: ['Backup'],
      summary: 'Delete a scheduled backup archive',
      params: scheduledBackupParamsSchema,
    },
  });
};
