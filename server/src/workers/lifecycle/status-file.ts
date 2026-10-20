import { writeFileAtomic } from '@camera.ui/common/node';

export const STATUS_FILE_NAME = 'worker-status.json';
export const STATUS_FILE_INTERVAL_MS = 15_000;

export interface WorkerStatus {
  state: string;
  reason?: string;
  master?: string;
  lastAnswerAt?: number;
  workloads: number;
}

export class StatusFile {
  private timer?: NodeJS.Timeout;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private file: string,
    private read: () => WorkerStatus,
  ) {}

  public start(): void {
    this.write();
    this.timer = setInterval(() => this.write(), STATUS_FILE_INTERVAL_MS);
    this.timer.unref();
  }

  public write(): void {
    const content = JSON.stringify({ ...this.read(), pid: process.pid, at: Date.now() });
    this.writing = this.writing.then(() => writeFileAtomic(this.file, content)).catch(() => {});
  }

  public async stop(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.writing;
  }
}
