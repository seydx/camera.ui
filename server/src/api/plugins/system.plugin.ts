import fp from 'fastify-plugin';

import { inject } from '../../container.js';

import type { ShutdownReason } from '@camera.ui/common/node';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { Go2Rtc } from '../../go2rtc/index.js';
import type { CameraUi } from '../../master.js';

declare module 'fastify' {
  interface FastifyInstance {
    system: System;
  }
  interface FastifyRequest {
    system: System;
  }
}

class System {
  private cameraui: CameraUi;
  private go2rtc: Go2Rtc;

  constructor(private app: FastifyInstance) {
    this.cameraui = inject('cameraui');
    this.go2rtc = inject('go2rtc');
  }

  public close(reason: ShutdownReason): void {
    this.cameraui.shutdown(reason);
  }

  public async restart(): Promise<void> {
    await this.cameraui.restart();
  }

  public async restartGo2rtc(): Promise<void> {
    await this.go2rtc.restart();
  }
}

export const SystemPlugin: FastifyPluginAsync = fp(async (app: FastifyInstance) => {
  const systemController = new System(app);

  app.decorate('system', systemController);
  app.decorateRequest('system', { getter: () => systemController });
});
