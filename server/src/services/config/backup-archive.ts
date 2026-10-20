import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
import { Transform } from 'node:stream';

import type { TransformCallback } from 'node:stream';

export interface BackupArchiveHeader {
  format: 2;
  createdAt: number;
  version: string;
  size: number;
  keyId: string;
  salt: string;
  nonce: string;
  chunkSize: number;
}

export interface BackupArchiveLayout {
  header: BackupArchiveHeader | null;
  headerBytes: Buffer;
  payloadOffset: number;
}

export type BackupArchiveErrorCode = 'not-a-backup' | 'damaged' | 'incomplete';

export class BackupArchiveError extends Error {
  constructor(
    message: string,
    public readonly code: BackupArchiveErrorCode,
  ) {
    super(message);
  }
}

export const ENCRYPTED_BACKUP_EXTENSION = '.cuibackup';

const MAGIC = Buffer.from('CUIBAK02');
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);
const MAX_HEADER_BYTES = 64 * 1024;
const CHUNK_SIZE = 1024 * 1024;
const MAX_CHUNK_SIZE = 16 * CHUNK_SIZE;
const TAG_BYTES = 16;
const NONCE_PREFIX_BYTES = 7;
const KEY_BYTES = 20;
const KEY_GROUP = 4;
const KEY_INFO = 'camera.ui backup v2';
const KEY_ID_INFO = 'camera.ui backup key id';
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newBackupKey(): string {
  return formatBackupKey(randomBytes(KEY_BYTES));
}

export function parseBackupKey(text: string): Buffer | null {
  const chars = text.toUpperCase().replace(/[\s-]/g, '');
  if (chars.length !== Math.ceil((KEY_BYTES * 8) / 5) || [...chars].some((char) => !BASE32.includes(char))) return null;

  const bytes: number[] = [];
  let value = 0;
  let bits = 0;
  for (const char of chars) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(bytes);
}

export function backupKeyId(key: Buffer): string {
  return createHmac('sha256', key).update(KEY_ID_INFO).digest('hex').slice(0, 16);
}

export function newArchiveHeader(key: Buffer, fields: Pick<BackupArchiveHeader, 'createdAt' | 'version' | 'size'>): BackupArchiveHeader {
  return {
    format: 2,
    ...fields,
    keyId: backupKeyId(key),
    salt: randomBytes(16).toString('base64'),
    nonce: randomBytes(NONCE_PREFIX_BYTES).toString('base64'),
    chunkSize: CHUNK_SIZE,
  };
}

export function encodeArchiveHeader(header: BackupArchiveHeader): Buffer {
  const json = Buffer.from(JSON.stringify(header));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(json.length);
  return Buffer.concat([MAGIC, length, json]);
}

export async function readArchiveLayout(path: string): Promise<BackupArchiveLayout> {
  const file = await open(path, 'r');
  try {
    const start = Buffer.alloc(MAGIC.length + 4);
    const { bytesRead } = await file.read(start, 0, start.length, 0);

    if (bytesRead >= GZIP_MAGIC.length && start.subarray(0, GZIP_MAGIC.length).equals(GZIP_MAGIC)) {
      return { header: null, headerBytes: Buffer.alloc(0), payloadOffset: 0 };
    }
    if (bytesRead < start.length || !start.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new BackupArchiveError('The file is not a camera.ui backup archive.', 'not-a-backup');
    }

    const length = start.readUInt32BE(MAGIC.length);
    if (length > MAX_HEADER_BYTES) throw new BackupArchiveError('The backup archive is damaged.', 'damaged');

    const json = Buffer.alloc(length);
    const read = await file.read(json, 0, length, start.length);
    if (read.bytesRead < length) throw new BackupArchiveError('The backup archive is incomplete.', 'incomplete');

    let header: BackupArchiveHeader;
    try {
      header = JSON.parse(json.toString('utf8'));
    } catch {
      throw new BackupArchiveError('The backup archive is damaged.', 'damaged');
    }
    if (typeof header.format === 'number' && header.format > 2) {
      throw new BackupArchiveError('This backup comes from a newer camera.ui. Update camera.ui first.', 'not-a-backup');
    }
    if (!isValidHeader(header)) throw new BackupArchiveError('The backup archive is damaged.', 'damaged');

    return { header, headerBytes: Buffer.concat([start, json]), payloadOffset: start.length + length };
  } finally {
    await file.close();
  }
}

export function createArchiveEncryptor(key: Buffer, header: BackupArchiveHeader, headerBytes: Buffer): Transform {
  return new ArchiveCipher(key, header, headerBytes, 'encrypt');
}

export function createArchiveDecryptor(key: Buffer, header: BackupArchiveHeader, headerBytes: Buffer): Transform {
  return new ArchiveCipher(key, header, headerBytes, 'decrypt');
}

function isValidHeader(header: BackupArchiveHeader): boolean {
  return (
    header.format === 2 &&
    Number.isSafeInteger(header.chunkSize) &&
    header.chunkSize > 0 &&
    header.chunkSize <= MAX_CHUNK_SIZE &&
    Number.isSafeInteger(header.size) &&
    typeof header.keyId === 'string' &&
    typeof header.salt === 'string' &&
    Buffer.from(header.nonce ?? '', 'base64').length === NONCE_PREFIX_BYTES
  );
}

function formatBackupKey(bytes: Buffer): string {
  let out = '';
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(value >>> bits) & 31];
      value &= (1 << bits) - 1;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out.match(new RegExp(`.{1,${KEY_GROUP}}`, 'g'))!.join('-');
}

class ArchiveCipher extends Transform {
  private readonly aesKey: Buffer;
  private readonly prefix: Buffer;
  private buffered: Buffer = Buffer.alloc(0);
  private index = 0;
  private finished = false;

  constructor(
    key: Buffer,
    private readonly header: BackupArchiveHeader,
    private readonly headerBytes: Buffer,
    private readonly direction: 'encrypt' | 'decrypt',
  ) {
    super();
    this.aesKey = Buffer.from(hkdfSync('sha256', key, Buffer.from(header.salt, 'base64'), KEY_INFO, 32));
    this.prefix = Buffer.from(header.nonce, 'base64');
  }

  public override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.buffered = this.buffered.length ? Buffer.concat([this.buffered, chunk]) : chunk;
    try {
      if (this.direction === 'encrypt') this.sealFull();
      else this.openFrames();
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  public override _flush(callback: TransformCallback): void {
    try {
      if (this.direction === 'encrypt') {
        this.push(this.seal(this.buffered, true));
      } else if (this.buffered.length || !this.finished) {
        throw new BackupArchiveError('The backup archive is incomplete.', 'incomplete');
      }
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  private sealFull(): void {
    while (this.buffered.length > this.header.chunkSize) {
      this.push(this.seal(this.buffered.subarray(0, this.header.chunkSize), false));
      this.buffered = this.buffered.subarray(this.header.chunkSize);
    }
  }

  private seal(plain: Buffer, final: boolean): Buffer {
    const cipher = createCipheriv('aes-256-gcm', this.aesKey, this.nonce(final));
    cipher.setAAD(this.headerBytes);
    const sealed = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(sealed.length);
    this.index++;
    return Buffer.concat([length, sealed]);
  }

  private openFrames(): void {
    while (this.buffered.length >= 4) {
      const length = this.buffered.readUInt32BE(0);
      if (length < TAG_BYTES || length > this.header.chunkSize + TAG_BYTES || this.finished) {
        throw new BackupArchiveError('The backup archive is damaged.', 'damaged');
      }
      if (this.buffered.length < 4 + length) return;

      const sealed = this.buffered.subarray(4, 4 + length);
      this.buffered = this.buffered.subarray(4 + length);
      const plain = this.open(sealed, false) ?? this.open(sealed, true);
      if (!plain) throw new BackupArchiveError('The backup archive is damaged.', 'damaged');
      this.index++;
      if (plain.length) this.push(plain);
    }
  }

  private open(sealed: Buffer, final: boolean): Buffer | null {
    const decipher = createDecipheriv('aes-256-gcm', this.aesKey, this.nonce(final));
    decipher.setAAD(this.headerBytes);
    decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
    try {
      const plain = Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - TAG_BYTES)), decipher.final()]);
      if (final) this.finished = true;
      return plain;
    } catch {
      return null;
    }
  }

  private nonce(final: boolean): Buffer {
    const nonce = Buffer.alloc(12);
    this.prefix.copy(nonce, 0);
    nonce.writeUInt32BE(this.index, NONCE_PREFIX_BYTES);
    nonce[11] = final ? 1 : 0;
    return nonce;
  }
}
