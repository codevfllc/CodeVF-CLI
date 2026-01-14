/**
 * Simple structured logger for CodeVF
 * 
 * CRITICAL: When running as an MCP server, all logs MUST go to stderr.
 * stdout is reserved for JSON-RPC protocol messages only.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel) {
    this.level = level;
  }

  debug(message: string, meta?: unknown) {
    if (this.level <= LogLevel.DEBUG) {
      // Always write to stderr for MCP compatibility
      process.stderr.write(`[DEBUG] ${message}${this.formatMeta(meta)}\n`);
    }
  }

  info(message: string, meta?: unknown) {
    if (this.level <= LogLevel.INFO) {
      // Always write to stderr for MCP compatibility
      process.stderr.write(`[INFO] ${message}${this.formatMeta(meta)}\n`);
    }
  }

  warn(message: string, meta?: unknown) {
    if (this.level <= LogLevel.WARN) {
      // Always write to stderr for MCP compatibility
      process.stderr.write(`[WARN] ${message}${this.formatMeta(meta)}\n`);
    }
  }

  error(message: string, error?: unknown) {
    if (this.level <= LogLevel.ERROR) {
      // Always write to stderr for MCP compatibility
      const errorInfo =
        error instanceof Error
          ? error.stack
          : error !== undefined
            ? JSON.stringify(error)
            : '';
      process.stderr.write(`[ERROR] ${message}${errorInfo ? ' ' + errorInfo : ''}\n`);
    }
  }

  private formatMeta(meta: unknown): string {
    if (meta === undefined) {
      return '';
    }
    return ` ${JSON.stringify(meta)}`;
  }
}

export const logger = new Logger();
