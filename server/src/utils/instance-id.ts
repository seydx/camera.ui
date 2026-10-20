import { randomBytes } from 'node:crypto';

let prefix = randomBytes(4).toString('hex');
let counter = 0;

export function setInstancePrefix(value: string): void {
  prefix = value;
}

export function nextInstanceId(): string {
  return `${prefix}-${++counter}`;
}
