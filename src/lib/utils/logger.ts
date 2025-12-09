/**
 * Simple structured logger for CodeVF
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

  debug(message: string, meta?: any) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  info(message: string, meta?: any) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  warn(message: string, meta?: any) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  error(message: string, error?: Error | any) {
    if (this.level <= LogLevel.ERROR) {
      console.error(
        `[ERROR] ${message}`,
        error instanceof Error ? error.stack : JSON.stringify(error)
      );
    }
  }
}

export const logger = new Logger();
