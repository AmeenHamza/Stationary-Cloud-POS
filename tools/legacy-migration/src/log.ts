import { appendFileSync } from 'node:fs';

type Level = 'info' | 'warn' | 'error';
type Fields = Readonly<Record<string, unknown>>;

/** Hides credentials in any text that might contain a connection string (an error message, say). */
export function redact(text: string): string {
  return text.replace(/(postgres(?:ql)?:\/\/)[^@\s/]*@/gi, '$1***@');
}

/**
 * Structured run log: one JSON line per event in `run.jsonl` (the run's audit trail and checkpoint
 * record), plus a readable line on the console. Nothing logged ever contains a connection string.
 */
export class RunLog {
  private file: string | null = null;

  constructor(private readonly console = true) {}

  /** Starts writing JSON lines to `file` (the run folder exists by then). */
  attach(file: string): void {
    this.file = file;
  }

  info(message: string, fields: Fields = {}): void {
    this.write('info', message, fields);
  }

  warn(message: string, fields: Fields = {}): void {
    this.write('warn', message, fields);
  }

  error(message: string, fields: Fields = {}): void {
    this.write('error', message, fields);
  }

  /** Console only: report text that is already in the report files. */
  print(text: string): void {
    if (this.console) {
      process.stdout.write(`${redact(text)}\n`);
    }
  }

  private write(level: Level, message: string, fields: Fields): void {
    const safe = redact(message);
    if (this.file !== null) {
      const line = JSON.stringify({
        at: new Date().toISOString(),
        level,
        message: safe,
        ...fields,
      });
      appendFileSync(this.file, `${redact(line)}\n`);
    }
    if (this.console) {
      const extra = Object.keys(fields).length === 0 ? '' : ` ${redact(JSON.stringify(fields))}`;
      const stream = level === 'info' ? process.stdout : process.stderr;
      stream.write(`[${level}] ${safe}${extra}\n`);
    }
  }
}
