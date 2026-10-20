const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 60_000;
const STABLE_RUN_MS = 30_000;
const MAX_CRASHES = 5;
const MAX_CLEAN_EXITS = 20;

export interface RestartPlan {
  clean: boolean;
  attempt: number;
  limit: number;
  delayMs?: number;
}

export class RestartBudget {
  private crashes = 0;
  private cleanExits = 0;

  public next(code: number | null, signal: NodeJS.Signals | null, ranMs: number): RestartPlan {
    if (ranMs > STABLE_RUN_MS) {
      this.crashes = 0;
      this.cleanExits = 0;
    }

    const clean = code === 0 && signal === null;
    const limit = clean ? MAX_CLEAN_EXITS : MAX_CRASHES;
    const done = clean ? this.cleanExits : this.crashes;
    if (done >= limit) {
      return { clean, attempt: done, limit };
    }

    const attempt = done + 1;
    if (clean) {
      this.cleanExits = attempt;
      return { clean, attempt, limit, delayMs: BASE_DELAY_MS };
    }

    this.crashes = attempt;
    return { clean, attempt, limit, delayMs: Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS) };
  }
}
