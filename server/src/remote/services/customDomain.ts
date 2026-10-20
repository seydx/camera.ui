import { normalizeUrl } from './urlReadiness.js';

import type { Logger } from '@camera.ui/common';
import type { HealthResponse } from '../../api/types/index.js';

export class CustomDomainService {
  private domain: string | null = null;

  constructor(private logger: Logger) {}

  public get url(): string | null {
    return this.domain;
  }

  public configure(domain: string): void {
    this.domain = normalizeUrl(domain);
  }

  public async testDomain(domain: string): Promise<boolean> {
    const base = normalizeUrl(domain);
    try {
      const response = await fetch(`${base}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        throw new Error(`${response.statusText} (${response.status})`);
      }

      const health: HealthResponse = await response.json();
      if (health.status !== 'ok') {
        throw new Error('health check failed: ' + JSON.stringify(health));
      }

      this.logger.log('Custom domain verified:', base);
      return true;
    } catch (error: any) {
      this.logger.warn(`Custom domain ${base} does not answer from this host: ${error?.message ?? error}. Clients get it once public DNS resolves it.`);
      return false;
    }
  }

  public reset(): void {
    this.domain = null;
  }
}
