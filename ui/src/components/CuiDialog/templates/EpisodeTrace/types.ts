import type { NVRInterface, RecordedEpisode } from '@camera.ui/nvr';
import type { Promisify } from '@camera.ui/rpc';
import type { DBCamera } from '@shared/types';

export interface EpisodeTraceProps {
  episode: RecordedEpisode;
  cameraById: Map<string, DBCamera>;
}

export type EpisodeTracePlugin = Pick<Promisify<NVRInterface>, 'getEpisodeTrace' | 'getEpisodeTraceImages' | 'nvrExportEpisode'>;
