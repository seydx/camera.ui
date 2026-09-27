import { defaultCameraSettings } from '../api/schemas/cameras.schema.js';

import type { CameraConfig } from '@camera.ui/sdk';
import type * as zod from 'zod';
import type { createCameraSchema } from '../api/schemas/cameras.schema.js';

export function adoptedCameraInput(config: CameraConfig): zod.input<typeof createCameraSchema> {
  const { name, nativeId, isCloud, disabled, info, type } = config;
  const sources = config.sources.map((source) => ({ ...source, urls: source.urls?.length ? source.urls : ['cui://127.0.0.1'] }));
  const input = { name, nativeId, isCloud, disabled, info, type, sources };

  if (info?.power !== 'battery') {
    return input;
  }

  const defaults = defaultCameraSettings();
  return {
    ...input,
    sources: sources.map((source) => ({ ...source, hotMode: source.hotMode ?? false, preload: source.preload ?? false })),
    snapshotSettings: { ...defaults.snapshotSettings, mode: 'onDemand' },
    interfaceSettings: { ...defaults.interfaceSettings, activityMode: 'standby' },
    recordingSettings: { ...defaults.recordingSettings, mode: 'adhoc' },
  };
}
