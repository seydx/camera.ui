const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 300_000;
const HEALTHY_RUN_MS = 60_000;

export class RestartBackoff {
  private attempts = 0;
  private registeredAt: number | null = null;

  public registered(): void {
    this.registeredAt ??= Date.now();
  }

  public nextDelay(): number {
    const healthy = this.registeredAt !== null && Date.now() - this.registeredAt >= HEALTHY_RUN_MS;
    this.registeredAt = null;

    if (healthy) {
      this.attempts = 0;
      return 0;
    }

    const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.attempts);
    this.attempts++;
    return Math.round(ceiling * (0.75 + Math.random() * 0.25));
  }

  public reset(): void {
    this.attempts = 0;
    this.registeredAt = null;
  }
}
