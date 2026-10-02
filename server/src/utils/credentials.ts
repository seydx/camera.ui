const SCHEME = /^([a-z][a-z0-9+.-]*:)(?:[a-z][a-z0-9+.-]*:(?=\/\/))?/i;
const HOST = /^(?:[\w.-]+|\[[\da-f:.]+\])(?::\d+)?$/i;

export function sourceOrigin(url: string): string {
  const trimmed = url.trim();
  const scheme = SCHEME.exec(trimmed)?.[0];
  if (!scheme) {
    return '';
  }
  if (!trimmed.startsWith('//', scheme.length)) {
    return scheme;
  }

  const rest = trimmed.slice(scheme.length + 2);
  const authority = rest.split(/[/?#\s]/, 1)[0];
  const host = authority.slice(authority.lastIndexOf('@') + 1);

  if (rest.includes('@', authority.length) || !HOST.test(host)) {
    return scheme;
  }
  return `${scheme}//${host}`;
}

export function withoutSourceCredentials<T extends { sources: { urls: string[] }[] }>(camera: T): T {
  return {
    ...camera,
    sources: camera.sources.map((source) => ({ ...source, urls: source.urls.map(sourceOrigin) })),
  };
}
