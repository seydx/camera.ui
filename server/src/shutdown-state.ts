const HOST_RESERVE_MS = 2000;
const MIN_CHILD_BUDGET_MS = 500;

let shuttingDown = false;
let deadline: number | undefined;

export function markShuttingDown(budgetMs?: number): void {
  shuttingDown = true;
  if (budgetMs !== undefined) {
    deadline = Date.now() + budgetMs;
  }
}

export function resetShuttingDown(): void {
  shuttingDown = false;
  deadline = undefined;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function childStopBudget(defaultMs: number): number {
  if (deadline === undefined) {
    return defaultMs;
  }
  return Math.max(MIN_CHILD_BUDGET_MS, Math.min(defaultMs, deadline - Date.now() - HOST_RESERVE_MS));
}
