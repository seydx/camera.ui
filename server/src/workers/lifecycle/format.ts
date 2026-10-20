export function shortId(id?: string): string {
  return id ? id.slice(0, 4) : '?';
}

export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString('en-GB', { hour12: false });
}
