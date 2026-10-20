export function runtimeBase(): string {
  const raw = typeof window !== 'undefined' ? window.__CUI_BASE__ : undefined;
  if (!raw || !raw.startsWith('/')) return '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

export function isEmbedded(): boolean {
  return runtimeBase() !== '/';
}

export function homeOrigin(): string {
  const base = runtimeBase();
  if (base === '/') return window.location.origin;
  return new URL(base, window.location.origin).href.replace(/\/$/, '');
}

export function embedHost(): string | null {
  const raw = typeof window !== 'undefined' ? window.__CUI_EMBED__ : undefined;
  return raw ? raw : null;
}

export function isHaPanel(): boolean {
  return embedHost() === 'homeassistant';
}

export function isHaIngress(): boolean {
  return embedHost() === 'hassio';
}

export function isHomeAssistant(): boolean {
  return isHaPanel() || isHaIngress();
}

export function isProxySignIn(): boolean {
  return typeof window !== 'undefined' && window.__CUI_AUTH__ === 'proxy';
}

export function proxyLogoutUrl(): string | null {
  const raw = typeof window !== 'undefined' ? window.__CUI_LOGOUT__ : undefined;
  return isProxySignIn() && raw ? raw : null;
}

export function canSignOut(): boolean {
  return !isHaIngress() && (!isProxySignIn() || proxyLogoutUrl() !== null);
}

export function isHaCards(): boolean {
  return typeof window !== 'undefined' && window.__CUI_HA_CARDS__ === true;
}
