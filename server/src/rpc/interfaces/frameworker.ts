import type { CameraDetectionSettings, CameraFrameWorkerSettings, CameraUiSettings, CameraZones, PtzAutotrackSettings } from '@camera.ui/sdk';
import type { DetectionCoordinatorConfig } from '../../camera/decoder/detection-coordinator.js';
import type { FrameWorkerPerfSnapshot, InitializeResult, ObjectBenchmarkResult } from '../../camera/decoder/types.js';

export interface FrameWorkerChildInterface {
  initialize(config: DetectionCoordinatorConfig): Promise<InitializeResult | void>;
  updateZoneConfig(zones: CameraZones): void;
  updateDetectionSettings(settings: CameraDetectionSettings): void;
  updatePtzAutotrackSettings(settings: PtzAutotrackSettings): void;
  updateFrameWorkerSettings(settings: CameraFrameWorkerSettings): void;
  updateInterfaceSettings(settings: CameraUiSettings): void;
  updateCameraName(name: string): void;
  updateNvrRpc(namespace?: string): void;
  getPerfSnapshot(): FrameWorkerPerfSnapshot | null;
  resetPerf(): void;
  pauseForBenchmark(paused: boolean): void;
  runObjectBenchmark(iterations: number, concurrency: number): Promise<ObjectBenchmarkResult | null>;
}
