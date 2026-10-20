import type { RPCClient } from '@camera.ui/rpc';
import type { BoundingBox, DetectionEvent, DetectionEventType, EventAttribute, EventDetection, EventSegment, LoggerService, Point } from '@camera.ui/sdk';
import type { TraceTick } from './event-trace.js';

export interface RecordedDetection extends EventDetection {
  box?: BoundingBox;
  trackId?: number;
  firstSeen?: number;
  lastSeen?: number;
  firstMovingSeen?: number;
  lastMovingSeen?: number;
  presentSince?: number;
}

export interface RecordedAttribute extends EventAttribute {
  parentTrackId?: number;
  unlisted?: boolean;
  embedding?: number[];
  embeddingModel?: string;
  clipEmbedding?: number[];
  clipEmbeddingModel?: string;
}

export interface RecordedPersonEmbedding {
  trackId: number;
  embedding: number[];
  embeddingModel: string;
}

export interface RecordedSegment extends Omit<EventSegment, 'detections' | 'attributes'> {
  thumbnailAt?: number;
  stripWindow?: BoundingBox;
  cardWindow?: BoundingBox;
  detections: RecordedDetection[];
  attributes: RecordedAttribute[];
  personEmbeddings?: RecordedPersonEmbedding[];
}

export interface RecordedEvent extends Omit<DetectionEvent, 'segments'> {
  segments: RecordedSegment[];
  thumbnailAt?: number;
}

export interface EventAttachments {
  scene?: Uint8Array;
  strip?: Uint8Array;
  card?: Uint8Array;
  attributes?: (Uint8Array | undefined)[];
  attributeLandmarks?: (Point[] | undefined)[];
  trace?: TraceTick[];
}

export function leanEvent(event: RecordedEvent): DetectionEvent {
  const { thumbnailAt: _at, segments, ...rest } = event;

  return {
    ...rest,
    segments: segments.map(({ thumbnailAt: _segAt, stripWindow: _sw, cardWindow: _cw, personEmbeddings: _pe, detections, attributes, ...segment }) => ({
      ...segment,
      detections: detections.map(
        ({ box: _box, trackId: _trackId, zones: _zones, firstSeen: _f, lastSeen: _l, firstMovingSeen: _fm, lastMovingSeen: _lm, presentSince: _ps, ...detection }) =>
          detection,
      ),
      attributes: attributes
        .filter((attribute) => attribute.type !== 'clip')
        .map(({ parentTrackId: _parent, embedding: _e, embeddingModel: _em, clipEmbedding: _c, clipEmbeddingModel: _cm, ...attribute }) => attribute),
    })),
  };
}

interface NvrIngest {
  ingestDetectionEvent(cameraId: string, type: DetectionEventType, event: RecordedEvent, attachments?: EventAttachments): Promise<void>;
}

const FOLD_AFTER = 32;
const MAX_QUEUED = 256;
const PROGRESS_TYPES: ReadonlySet<DetectionEventType> = new Set(['update', 'segment-update']);

interface QueuedMessage {
  type: DetectionEventType;
  event: RecordedEvent;
  attachments?: EventAttachments;
}

function hasMoment(attachments?: EventAttachments): boolean {
  return attachments?.strip !== undefined || attachments?.card !== undefined;
}

function mergeAttachments(older?: EventAttachments, newer?: EventAttachments): EventAttachments | undefined {
  if (!older || !newer) return newer ?? older;

  const merged: EventAttachments = {};
  const scene = newer.scene ?? older.scene;
  if (scene) merged.scene = scene;
  const moment = hasMoment(newer) ? newer : older;
  if (moment.strip) merged.strip = moment.strip;
  if (moment.card) merged.card = moment.card;
  if (older.trace || newer.trace) merged.trace = [...(older.trace ?? []), ...(newer.trace ?? [])];

  if (older.attributes || newer.attributes) {
    const length = Math.max(older.attributes?.length ?? 0, newer.attributes?.length ?? 0);
    const crops: (Uint8Array | undefined)[] = [];
    const landmarks: (Point[] | undefined)[] = [];
    for (let index = 0; index < length; index++) {
      const source = newer.attributes?.[index] ? newer : older;
      crops.push(source.attributes?.[index]);
      landmarks.push(source.attributeLandmarks?.[index]);
    }
    merged.attributes = crops;
    if (landmarks.some((points) => points?.length)) merged.attributeLandmarks = landmarks;
  }
  return merged;
}

export class NvrSink {
  private rpc?: NvrIngest;
  private tail: Promise<void> = Promise.resolve();
  private queued = 0;
  private waiting?: QueuedMessage;

  constructor(
    private readonly proxy: RPCClient,
    private readonly logger: LoggerService,
  ) {}

  public get connected(): boolean {
    return this.rpc !== undefined;
  }

  public setNamespace(namespace: string | undefined): void {
    this.rpc = namespace ? this.proxy.createProxy<NvrIngest>(namespace) : undefined;
  }

  public send(type: DetectionEventType, event: RecordedEvent, attachments?: EventAttachments): void {
    if (!this.rpc) return;
    if (this.queued >= FOLD_AFTER && this.fold(type, event, attachments)) return;
    if (this.queued >= MAX_QUEUED) {
      this.logger.debug(`NVR plugin is ${this.queued} messages behind, dropped the ${type} message`);
      return;
    }

    const message: QueuedMessage = { type, event: structuredClone(event), attachments };
    this.waiting = message;
    this.queued++;
    this.tail = this.tail.then(async () => {
      if (this.waiting === message) this.waiting = undefined;
      try {
        await this.rpc?.ingestDetectionEvent(message.event.cameraId, message.type, message.event, message.attachments);
      } catch (error) {
        this.logger.debug(`NVR plugin did not take the ${type} message:`, error);
      } finally {
        this.queued--;
      }
    });
  }

  private fold(type: DetectionEventType, event: RecordedEvent, attachments?: EventAttachments): boolean {
    const waiting = this.waiting;
    if (waiting?.type !== type || !PROGRESS_TYPES.has(type)) return false;
    if (waiting.event.id !== event.id || waiting.event.segmentIndex !== event.segmentIndex) return false;
    if (hasMoment(waiting.attachments) && hasMoment(attachments)) return false;

    waiting.event = structuredClone(event);
    waiting.attachments = mergeAttachments(waiting.attachments, attachments);
    return true;
  }
}
