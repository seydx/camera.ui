import { inject } from '../../container.js';

import type { ActionContext } from './types.js';

export async function actionNotificationControl(ctx: ActionContext, data: Record<string, unknown>): Promise<void> {
  const suppressed = data.mode !== 'enable';
  const scope = data.scope === 'user' || data.scope === 'camera' ? data.scope : 'global';

  const notificationManager = inject('proxy').notificationManager;

  if (scope === 'camera') {
    const cameraId = ctx.resolve((data.cameraId as string) ?? '').trim();
    if (!cameraId) {
      ctx.logger.warn(`[automation:${ctx.flowName}] action-notification-control skipped — no camera selected`);
      return;
    }
    await notificationManager.setCameraSuppressed(cameraId, suppressed);
    return;
  }

  if (scope === 'user') {
    const userId = ctx.resolve((data.userId as string) ?? '').trim();
    if (!userId) {
      ctx.logger.warn(`[automation:${ctx.flowName}] action-notification-control skipped — no user selected`);
      return;
    }
    await notificationManager.setUserSuppressed(userId, suppressed);
    return;
  }

  await notificationManager.setGlobalSuppressed(suppressed);
}
