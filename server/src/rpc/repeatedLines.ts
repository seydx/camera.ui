const WINDOW_MS = 60_000;
const MAX_KINDS = 100;
const NUMBER = /(?<![\w./"'-])(\d+h)?(\d+m)?\d+(\.\d+)?(ms|µs|us|ns|s)?(?![\w/"'-]|\.\d)/g;

type RepeatLevel = 'warn' | 'error';

interface Repeat {
  level: RepeatLevel;
  line: string;
  count: number;
  total: number;
  lastAt: number;
  windows: number;
  timer?: NodeJS.Timeout;
}

export class RepeatedLines {
  private repeats = new Map<string, Repeat>();

  constructor(private readonly emit: (level: RepeatLevel | 'log' | 'debug', line: string) => void) {}

  public push(level: RepeatLevel, line: string): void {
    const kind = lineKind(line);
    const repeat = this.repeats.get(kind);

    if (repeat) {
      repeat.line = line;
      repeat.count++;
      repeat.total++;
      repeat.lastAt = Date.now();
      return;
    }

    this.emit(level, line);

    if (this.repeats.size < MAX_KINDS) {
      const entry: Repeat = { level, line, count: 0, total: 0, windows: 0, lastAt: Date.now() };
      this.repeats.set(kind, entry);
      this.schedule(kind, entry);
    }
  }

  public flush(): void {
    for (const repeat of this.repeats.values()) {
      clearTimeout(repeat.timer);
      if (repeat.count > 0) {
        this.emit(repeat.level, summary(repeat, repeat.windows + 1));
      }
    }
    this.repeats.clear();
  }

  public settle(matches: (line: string) => boolean, reason: string): void {
    for (const [kind, repeat] of this.repeats) {
      if (!matches(repeat.line)) {
        continue;
      }
      clearTimeout(repeat.timer);
      this.repeats.delete(kind);
      if (repeat.total > 0) {
        this.emit('debug', `${repeat.line} (${repeat.total} more ${reason})`);
      }
    }
  }

  private schedule(kind: string, repeat: Repeat): void {
    repeat.timer = setTimeout(() => this.report(kind, repeat), WINDOW_MS);
    repeat.timer.unref();
  }

  private report(kind: string, repeat: Repeat): void {
    repeat.windows++;

    if (repeat.count > 0) {
      this.emit(repeat.level, summary(repeat, repeat.windows));
      repeat.count = 0;
      repeat.windows = 0;
      this.schedule(kind, repeat);
      return;
    }

    // a line repeating about once a window can miss one, wait for a second
    if (repeat.windows < 2) {
      this.schedule(kind, repeat);
      return;
    }

    this.repeats.delete(kind);
    if (repeat.total > 0) {
      this.emit('log', `${repeat.line} (stopped after ${repeat.total} more, the last at ${clock(repeat.lastAt)})`);
    }
  }
}

export function lineKind(line: string): string {
  return line
    .replace(/\[[0-9a-f]*:[^\]\s]*\](:\d+)?/gi, '<addr>')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/g, '<addr>')
    .replace(NUMBER, '#');
}

function summary(repeat: Repeat, windows: number): string {
  return `${repeat.line} (${repeat.count} more in the last ${(windows * WINDOW_MS) / 1000} s, the last at ${clock(repeat.lastAt)})`;
}

function clock(at: number): string {
  const date = new Date(at);
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
