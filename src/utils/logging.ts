export type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

let currentLevel: LogLevel = "info";

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[currentLevel];
}

function timestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string): string {
  return `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug(message: string, ...optionalParams: unknown[]): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message), ...optionalParams);
    }
  },

  info(message: string, ...optionalParams: unknown[]): void {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message), ...optionalParams);
    }
  },

  warn(message: string, ...optionalParams: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message), ...optionalParams);
    }
  },

  error(message: string, ...optionalParams: unknown[]): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message), ...optionalParams);
    }
  }
};

export function setLogLevel(level: LogLevel): void {
  if (!(level in levelPriority)) {
    logger.warn(
      `Attempted to set invalid log level '${level}', keeping previous level '${currentLevel}'.`
    );
    return;
  }
  currentLevel = level;
  logger.info(`Log level set to '${level}'.`);
}