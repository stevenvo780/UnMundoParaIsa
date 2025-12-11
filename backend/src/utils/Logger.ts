export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
}

export class Logger {
  private static level: LogLevel = LogLevel.INFO;

  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }

  static debug(...args: unknown[]): void {
    if (Logger.level <= LogLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.debug("[DEBUG]", ...args);
    }
  }

  static info(...args: unknown[]): void {
    if (Logger.level <= LogLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log("[INFO]", ...args);
    }
  }

  static warn(...args: unknown[]): void {
    if (Logger.level <= LogLevel.WARN) {
      // eslint-disable-next-line no-console
      console.warn("[WARN]", ...args);
    }
  }

  static error(...args: unknown[]): void {
    if (Logger.level <= LogLevel.ERROR) {
      // eslint-disable-next-line no-console
      console.error("[ERROR]", ...args);
    }
  }
}
