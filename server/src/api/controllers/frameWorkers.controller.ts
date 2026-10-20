import { orderBy } from '@camera.ui/common/utils';
import { container } from 'tsyringe';

import { ConfigService } from '../../services/config/index.js';
import { collectSystemInfo } from '../../utils/system-info.js';
import { WorkerCapability } from '../../workers/types.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CameraUiAPI } from '../../api.js';
import type { BenchmarkHost, ObjectBenchmarkResult, ObjectBenchmarkRun } from '../../camera/decoder/types.js';
import type { PluginManager } from '../../plugins/index.js';
import type { WorkerManager } from '../../workers/manager.js';
import type { SystemInfo } from '../../utils/system-info.js';
import type { AuthLoginRequest, FrameWorker, FrameWorkerParamsNameRequest, PaginationRequest } from '../types/index.js';

export class FrameWorkersController {
  private api: CameraUiAPI;
  private pluginManager: PluginManager;
  private workerManager: WorkerManager;
  private benchmarkRun?: Promise<ObjectBenchmarkRun | null>;

  constructor(private app: FastifyInstance) {
    this.api = container.resolve<CameraUiAPI>('api');
    this.pluginManager = container.resolve<PluginManager>('pluginManager');
    this.workerManager = container.resolve<WorkerManager>('workerManager');
  }

  public list(_req: FastifyRequest<AuthLoginRequest & PaginationRequest>, reply: FastifyReply): FastifyReply | FrameWorker[] {
    try {
      const cameraControllers = this.api.getCameras();
      const frameWorkers = cameraControllers.map((cameraController) => {
        const frameWorker = cameraController.frameWorker;

        return {
          name: frameWorker.name,
          status: frameWorker.status,
        };
      });

      return orderBy(frameWorkers, ['name'], ['asc']);
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  public async resetPerf(_req: FastifyRequest<AuthLoginRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      await Promise.all(this.api.getCameras().map((cameraController) => cameraController.frameWorker.resetPerf()));

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  public async benchmark(
    req: FastifyRequest<AuthLoginRequest & { Body?: { cameras?: string[]; iterations?: number; concurrency?: number } }>,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const iterations = Math.min(2000, Math.max(20, req.body?.iterations ?? 200));
    const concurrency = Math.min(16, Math.max(1, req.body?.concurrency ?? 4));

    try {
      this.benchmarkRun ??= this.runBenchmark(req.body?.cameras, iterations, concurrency).finally(() => {
        this.benchmarkRun = undefined;
      });

      const run = await this.benchmarkRun;
      if (!run) {
        return reply.code(404).send({
          statusCode: 404,
          message: 'No camera with an object detector',
        });
      }

      return reply.code(200).send(run);
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  private async runBenchmark(cameras: string[] | undefined, iterations: number, concurrency: number): Promise<ObjectBenchmarkRun | null> {
    const controllers = this.api.getCameras();
    const selection = cameras?.length ? controllers.filter((controller) => cameras.includes(controller.frameWorker.name)) : controllers;

    try {
      await Promise.all(controllers.map((controller) => controller.frameWorker.pauseForBenchmark(true)));

      const systems = new Map<string, SystemInfo | undefined>();
      const results = await Promise.all(
        selection.map(async (controller): Promise<ObjectBenchmarkResult | null> => {
          const worker = controller.frameWorker;
          const result = await worker.runObjectBenchmark(iterations, concurrency);
          if (!result) return null;

          const remote = worker.isRemoteWorker ? this.workerManager.getRemoteProcess(WorkerCapability.FrameDecoding, controller.id) : undefined;
          if (remote) systems.set(remote.worker, remote.system);
          return { ...result, camera: worker.name, plugin: this.pluginName(result.plugin), worker: remote?.worker };
        }),
      );
      const measured = results.filter((result): result is ObjectBenchmarkResult => result !== null);
      if (measured.length === 0) return null;

      const done = measured.reduce((sum, result) => sum + result.iterations, 0);
      const handlerMs = measured.reduce((sum, result) => sum + result.handlerMs * result.iterations, 0);

      return {
        hosts: await this.benchmarkHosts(measured, systems),
        total: {
          cameras: measured.length,
          iterations: done,
          failed: measured.reduce((sum, result) => sum + result.failed, 0),
          concurrency: concurrency * measured.length,
          totalMs: Math.max(...measured.map((result) => result.totalMs)),
          perSecond: Math.round(measured.reduce((sum, result) => sum + result.perSecond, 0) * 10) / 10,
          handlerMs: done > 0 ? Math.round((handlerMs / done) * 10) / 10 : 0,
        },
        cameras: measured,
      };
    } finally {
      await Promise.all(controllers.map((controller) => controller.frameWorker.pauseForBenchmark(false)));
    }
  }

  private async benchmarkHosts(measured: ObjectBenchmarkResult[], systems: Map<string, SystemInfo | undefined>): Promise<BenchmarkHost[]> {
    const hosts: BenchmarkHost[] = [];

    if (measured.some((result) => !result.worker)) {
      hosts.push({ system: await collectSystemInfo(ConfigService.RUNNING_VERSION) });
    }

    for (const name of new Set(measured.map((result) => result.worker).filter((worker): worker is string => Boolean(worker)))) {
      hosts.push({ worker: name, system: systems.get(name) });
    }

    return hosts;
  }

  private pluginName(pluginId: string): string {
    for (const plugin of this.pluginManager.plugins.values()) {
      if (plugin.id === pluginId) return plugin.displayName ?? plugin.pluginName;
    }
    return pluginId;
  }

  public async restartByName(req: FastifyRequest<AuthLoginRequest & FrameWorkerParamsNameRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const cameraControllers = this.api.getCameras();
      const cameraController = cameraControllers.find((cameraController) => cameraController.frameWorker.name === req.params.frameworkername);
      const frameWorker = cameraController?.frameWorker;

      if (!frameWorker) {
        return reply.code(404).send({
          statusCode: 404,
          message: 'Frame Worker not exists',
        });
      }

      await frameWorker.restart();

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  public async startByName(req: FastifyRequest<AuthLoginRequest & FrameWorkerParamsNameRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const cameraControllers = this.api.getCameras();
      const cameraController = cameraControllers.find((cameraController) => cameraController.frameWorker.name === req.params.frameworkername);
      const frameWorker = cameraController?.frameWorker;

      if (!frameWorker) {
        return reply.code(404).send({
          statusCode: 404,
          message: 'Frame Worker not exists',
        });
      }

      await frameWorker.start();

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  public async stopByName(req: FastifyRequest<AuthLoginRequest & FrameWorkerParamsNameRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const cameraControllers = this.api.getCameras();
      const cameraController = cameraControllers.find((cameraController) => cameraController.frameWorker.name === req.params.frameworkername);
      const frameWorker = cameraController?.frameWorker;

      if (!frameWorker) {
        return reply.code(404).send({
          statusCode: 404,
          message: 'Frame Worker not exists',
        });
      }

      await frameWorker.close();

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }
}
