import { isLanClientAddress, isLoopbackAddress } from '@camera.ui/common/network';
import { constants, createDeflateRaw } from 'node:zlib';

import type { IncomingMessage } from 'node:http';
import type { DeflateRaw } from 'node:zlib';

type Job = [data: Buffer, deflate: boolean] | (() => void);

const MIN_COMPRESS_BYTES = 256;
const SAMPLE_BYTES = 1024;
const SAMPLES = 4;
const MAX_ENTROPY_BITS = 6.8;
const PROXY_HEADERS = ['x-forwarded-cloud', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-forwarded-host'];
const FRAME_DEFLATE = 'cui-deflate';
const FRAME_RAW = 0x00;
const FRAME_DEFLATED = 0x01;
const DEFLATED_HEADER = 5;
const SYNC_FLUSH_TAIL = 4;
const MAX_BATCH_BYTES = 256 * 1024;

const counts = new Uint32Array(256);
const nLog2n = new Float64Array(SAMPLE_BYTES + 1);
for (let n = 1; n <= SAMPLE_BYTES; n++) nLog2n[n] = n * Math.log2(n);

export function isRemoteClient(request: IncomingMessage): boolean {
  if (PROXY_HEADERS.some((header) => !!request.headers[header])) return true;
  const { remoteAddress = '', localAddress } = request.socket;
  return !isLoopbackAddress(remoteAddress) && !isLanClientAddress(remoteAddress, localAddress);
}

export function wantsFrameDeflate(request: IncomingMessage, url: URL): boolean {
  return url.searchParams.get('compress') === FRAME_DEFLATE && !request.headers['x-ingress-path'];
}

export function worthCompressing(data: Uint8Array): boolean {
  if (data.length < MIN_COMPRESS_BYTES) return false;
  if (data.length < SAMPLE_BYTES) return true;

  let bits = 0;
  for (let k = 0; k < SAMPLES; k++) {
    bits += entropy(data, Math.floor(((data.length - SAMPLE_BYTES) * k) / (SAMPLES - 1)), SAMPLE_BYTES);
  }
  return bits / SAMPLES < MAX_ENTROPY_BITS;
}

function entropy(data: Uint8Array, offset: number, length: number): number {
  counts.fill(0);
  for (let i = offset; i < offset + length; i++) counts[data[i]]++;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += nLog2n[counts[i]];
  return Math.log2(length) - sum / length;
}

export class FrameDeflater {
  public pending = 0;
  public onFrame: (frame: Buffer) => void = () => {};
  public onError: (err: Error) => void = () => {};
  private zlib: DeflateRaw;
  private output: Buffer[] = [];
  private outputBytes = 0;
  private jobs: Job[] = [];
  private busy = false;
  private closed = false;

  constructor() {
    this.zlib = createDeflateRaw({ level: 1, chunkSize: 64 * 1024, flush: constants.Z_SYNC_FLUSH });
    this.zlib.on('data', (chunk: Buffer) => {
      this.output.push(chunk);
      this.outputBytes += chunk.length;
    });
    this.zlib.on('error', (err: Error) => {
      if (this.closed) return;
      this.close();
      this.onError(err);
    });
  }

  public push(data: Buffer): void {
    if (this.closed) return;
    const deflate = worthCompressing(data);
    if (!deflate && !this.busy && !this.jobs.length) {
      this.onFrame(rawFrame(data));
      return;
    }
    this.jobs.push([data, deflate]);
    this.pending += data.length;
    this.run();
  }

  public whenDrained(done: () => void): void {
    if (this.busy || this.jobs.length) this.jobs.push(done);
    else done();
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    this.busy = false;
    this.jobs.length = 0;
    this.pending = 0;
    this.zlib.close();
  }

  private run(): void {
    while (!this.busy && this.jobs.length) {
      const job = this.jobs[0];
      if (typeof job === 'function') {
        this.jobs.shift();
        job();
      } else if (!job[1]) {
        this.jobs.shift();
        this.pending -= job[0].length;
        this.onFrame(rawFrame(job[0]));
      } else {
        this.deflateBatch();
      }
    }
  }

  private deflateBatch(): void {
    const batch: Buffer[] = [];
    let length = 0;
    while (this.jobs.length && length < MAX_BATCH_BYTES) {
      const job = this.jobs[0];
      if (typeof job === 'function' || !job[1]) break;
      this.jobs.shift();
      batch.push(job[0]);
      length += job[0].length;
    }
    this.busy = true;
    this.zlib.write(batch.length === 1 ? batch[0] : Buffer.concat(batch, length), () => this.deflated(length));
  }

  private deflated(length: number): void {
    if (this.closed) return;
    const frame = Buffer.allocUnsafe(DEFLATED_HEADER + this.outputBytes - SYNC_FLUSH_TAIL);
    frame[0] = FRAME_DEFLATED;
    frame.writeUInt32BE(length, 1);
    let offset = DEFLATED_HEADER;
    for (const chunk of this.output) offset += chunk.copy(frame, offset, 0, Math.min(chunk.length, frame.length - offset));
    this.output = [];
    this.outputBytes = 0;
    this.pending -= length;
    this.busy = false;
    this.onFrame(frame);
    this.run();
  }
}

function rawFrame(data: Buffer): Buffer {
  const frame = Buffer.allocUnsafe(data.length + 1);
  frame[0] = FRAME_RAW;
  data.copy(frame, 1);
  return frame;
}
