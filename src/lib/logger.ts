/**
 * Production-safe logging service
 * Replaces console.log/error/warn with structured logging
 * In development: logs to console
 * In production: sends to observability service (Sentry, LogRocket, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private isProduction = import.meta.env.PROD;

  private formatLog(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...(context && { context }) };

    if (this.isDevelopment) {
      // Development: output to console with colors
      const colors = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[37m',  // white
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      };
      const reset = '\x1b[0m';
      console.log(
        `${colors[level]}[${level.toUpperCase()}]${reset} ${message}`,
        context ? logEntry : ''
      );
    }

    if (this.isProduction) {
      // Production: send to observability service
      this.sendToObservability(logEntry);
    }
  }

  private sendToObservability(logEntry: any): void {
    // This will be replaced with actual service integration
    // Examples: Sentry.captureMessage, LogRocket.log, etc.
    try {
      // Placeholder for observable service
      if (typeof window !== 'undefined' && (window as any).__observability__) {
        (window as any).__observability__.log(logEntry);
      }
    } catch (e) {
      // Fail silently to avoid cascading errors
    }
  }

  debug(message: string, context?: LogContext): void {
    this.formatLog('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.formatLog('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.formatLog('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        errorMessage: error.message,
        errorStack: error.stack,
      }),
      ...(error instanceof Error === false && {
        error: String(error),
      }),
    };
    this.formatLog('error', message, errorContext);
  }
}

export const logger = new Logger();
