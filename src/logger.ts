/**
 * Structured logger for Medical MCP Server
 * Provides leveled, structured logging with source tracking and timing.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  durationMs?: number;
  query?: string;
  resultCount?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private level: LogLevel;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || "INFO").toUpperCase();
    this.level = LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  private formatEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      `[${entry.source}]`,
      entry.message,
    ];
    if (entry.durationMs !== undefined) {
      parts.push(`(${entry.durationMs}ms)`);
    }
    if (entry.query) {
      parts.push(`query="${entry.query}"`);
    }
    if (entry.resultCount !== undefined) {
      parts.push(`results=${entry.resultCount}`);
    }
    if (entry.error) {
      parts.push(`error="${entry.error}"`);
    }
    return parts.join(" ");
  }

  private log(
    level: LogLevel,
    levelName: string,
    source: string,
    message: string,
    extra?: Partial<LogEntry>,
  ) {
    if (level < this.level) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      source,
      message,
      ...extra,
    };

    // Always log to stderr (MCP convention — stdout is for protocol)
    console.error(this.formatEntry(entry));
  }

  debug(source: string, message: string, extra?: Partial<LogEntry>) {
    this.log(LogLevel.DEBUG, "DEBUG", source, message, extra);
  }

  info(source: string, message: string, extra?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, "INFO", source, message, extra);
  }

  warn(source: string, message: string, extra?: Partial<LogEntry>) {
    this.log(LogLevel.WARN, "WARN", source, message, extra);
  }

  error(source: string, message: string, extra?: Partial<LogEntry>) {
    this.log(LogLevel.ERROR, "ERROR", source, message, extra);
  }

  /**
   * Create a timer that logs duration when stopped
   */
  startTimer(
    source: string,
    operation: string,
  ): { stop: (extra?: Partial<LogEntry>) => number } {
    const start = Date.now();
    return {
      stop: (extra?: Partial<LogEntry>) => {
        const durationMs = Date.now() - start;
        this.info(source, `${operation} completed`, { durationMs, ...extra });
        return durationMs;
      },
    };
  }
}

export const logger = new Logger();
