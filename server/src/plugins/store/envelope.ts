import { Packr } from 'msgpackr';
import { crc32 } from 'node:zlib';

// plain msgpack the go and python sides can read, int64 stays a number instead of BigInt
const packr = new Packr({ useRecords: false, bundleStrings: false, int64AsType: 'number' });

const MAGIC = Buffer.from('CUI1');

export class StoreCorruptError extends Error {
  constructor(message: string) {
    super(`store envelope: ${message}`);
    this.name = 'StoreCorruptError';
  }
}

export function encodeEnvelope(payload: Record<string, any>): Buffer {
  const body = packr.pack(payload);
  const crc = Buffer.allocUnsafe(4);
  crc.writeUInt32LE(crc32(body) >>> 0);
  return Buffer.concat([MAGIC, body, crc]);
}

export function envelopeRev(buf: Buffer): string {
  return `${buf.readUInt32LE(buf.length - 4).toString(16)}.${buf.length}`;
}

export function decodeEnvelope(buf: Buffer): Record<string, any> {
  if (buf.length < MAGIC.length + 4 || !buf.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new StoreCorruptError('bad magic');
  }

  const body = buf.subarray(MAGIC.length, buf.length - 4);
  if (crc32(body) >>> 0 !== buf.readUInt32LE(buf.length - 4)) {
    throw new StoreCorruptError('crc mismatch');
  }

  let payload: unknown;
  try {
    payload = packr.unpack(body);
  } catch (error) {
    throw new StoreCorruptError(`payload decode failed: ${error instanceof Error ? error.message : error}`);
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new StoreCorruptError('payload is not a map');
  }

  return payload as Record<string, any>;
}
