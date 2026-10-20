const FAILED = /Error trying to connect as leafnode to remote server \S+ \(attempt \d+\): (.+)$/;
const REJECTED = /Leafnode Error '(Authorization Violation)'|TLS leafnode handshake error: (.*(?:x509|certificate).*)$/;

export type LeafRejection = 'auth' | 'certificate';

export function isLeafDialError(line: string): boolean {
  return FAILED.test(line);
}

export class LeafConnection {
  public onCreated?: () => void;
  public onRejected?: (reason: string, kind: LeafRejection) => void;

  private error?: string;

  public get lastError(): string | undefined {
    return this.error;
  }

  public observe(line: string): void {
    if (line.includes('Leafnode connection created')) {
      this.onCreated?.();
      return;
    }

    const rejected = REJECTED.exec(line);
    if (rejected) {
      this.error = rejected[1] ?? rejected[2];
      this.onRejected?.(this.error, rejected[1] ? 'auth' : 'certificate');
      return;
    }

    const failed = FAILED.exec(line);
    if (failed) {
      this.error = failed[1];
    }
  }

  public reset(): void {
    this.error = undefined;
  }
}
