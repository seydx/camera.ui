import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inject } from '../container.js';

const BASE_RE = /^\/[A-Za-z0-9/_-]*\/$/;
const EMBED_HOSTS = new Set(['homeassistant', 'hassio']);
const rendered = new Map<string, string>();
let rawHtml: string | undefined;

function raw(): string {
  if (rawHtml === undefined) {
    const config = inject('configService');
    rawHtml = readFileSync(join(config.INTERFACE_CACHE_PATH, 'index.html'), 'utf8');
  }
  return rawHtml;
}

export function normalizeBase(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return '/';
  const withSlash = value.endsWith('/') ? value : `${value}/`;
  return BASE_RE.test(withSlash) ? withSlash : '/';
}

export function normalizeEmbed(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value && EMBED_HOSTS.has(value) ? value : '';
}

export function isProxySignIn(header: string | string[] | undefined): boolean {
  return (Array.isArray(header) ? header[0] : header) === 'proxy';
}

export function renderIndexHtml(base: string, embed = '', proxied = false): string {
  const logoutUrl = proxied ? (inject('configService').proxyAuth?.logoutUrl ?? '') : '';
  const key = `${base}\n${embed}\n${proxied ? `proxy ${logoutUrl}` : ''}`;
  const cached = rendered.get(key);
  if (cached) return cached;

  const html = raw()
    .replace(/((?:src|href)=")\.\//g, `$1${base}`)
    .replace(/window\.__CUI_BASE__\s*=\s*'[^']*'/, `window.__CUI_BASE__ = '${base}'`)
    .replace(/window\.__CUI_EMBED__\s*=\s*'[^']*'/, `window.__CUI_EMBED__ = '${embed}'`)
    .replace(/window\.__CUI_AUTH__\s*=\s*'[^']*'/, `window.__CUI_AUTH__ = '${proxied ? 'proxy' : ''}'`)
    .replace(/window\.__CUI_LOGOUT__\s*=\s*'[^']*'/, () => `window.__CUI_LOGOUT__ = ${JSON.stringify(logoutUrl).replace(/</g, '\\u003c')}`);
  if (rendered.size < 16) rendered.set(key, html);
  return html;
}
