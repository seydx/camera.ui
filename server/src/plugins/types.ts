import type { Camera, PluginInfo } from '@camera.ui/sdk';

export const PLUGIN_IDENTIFIER_PATTERN = /^((@[\w-.]*)\/)?(camera-ui-[\w-]*)$/;

export interface Context {
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
}

export interface ProcessSession {
  runId: string;
  level: number;
  instanceId?: string;
}

export interface ProcessLoadMessage {
  cameras: Camera[];
  plugin: PluginInfo;
  storage: PluginStorage;
  session?: ProcessSession;
}

export interface ResumeData {
  runId: string;
  instanceId?: string;
}

export type ProcessMessage = { type: PLUGIN_COMMAND.START; data: ProcessLoadMessage } | { type: PLUGIN_COMMAND.RESUME; data: ResumeData } | { type: PLUGIN_COMMAND.STOP };

export interface ProcessResponse {
  type: PLUGIN_STATUS;
  error?: string;
  instanceId?: string;
  handshake?: number;
  resume?: boolean;
  runId?: string;
  resumed?: boolean;
  code?: 'resume-mismatch';
}

export enum PLUGIN_STATUS {
  READY = 'ready',
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  UNKNOWN = 'unknown',
  DISABLED = 'disabled',
  INCOMPATIBLE = 'incompatible',
  UPDATE_REQUIRED = 'update_required',
  SERVER_UPDATE_REQUIRED = 'server_update_required',
}

export enum PLUGIN_COMMAND {
  START = 'start',
  STOP = 'stop',
  RESUME = 'resume',
}

export interface PluginStorage {
  installPath: string;
  storagePath: string;
}
