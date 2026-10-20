const SCRIPT_RE = /<script\b([^>]*)>[\s\S]*?<\/script>/gi;

export function entryScriptSrc(html: string, baseUrl: string): string | null {
  for (const [, attributes] of html.matchAll(SCRIPT_RE)) {
    if (!/\btype=["']?module\b/i.test(attributes)) continue;
    const src = /\bsrc=["']([^"']+)["']/i.exec(attributes)?.[1];
    if (src) return new URL(src, baseUrl).href;
  }
  return null;
}
