/**
 * Structured JSON logger with correlation IDs.
 * Provides consistent, machine-parseable logs across all edge functions.
 */

export interface LogContext {
  requestId: string;
  functionName: string;
  organizationId?: string;
  userId?: string;
}

type LogLevel = "info" | "warn" | "error" | "debug";

function emit(level: LogLevel, ctx: LogContext, message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: ctx.requestId,
    fn: ctx.functionName,
    orgId: ctx.organizationId,
    userId: ctx.userId,
    msg: message,
    ...data,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function createLogger(functionName: string, req?: Request): LogContext & {
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
  setOrg: (orgId: string) => void;
  setUser: (userId: string) => void;
} {
  const requestId = req?.headers.get("x-request-id") || crypto.randomUUID();

  const ctx: LogContext = { requestId, functionName };

  return {
    ...ctx,
    info: (msg, data) => emit("info", ctx, msg, data),
    warn: (msg, data) => emit("warn", ctx, msg, data),
    error: (msg, data) => emit("error", ctx, msg, data),
    setOrg: (orgId: string) => { ctx.organizationId = orgId; },
    setUser: (userId: string) => { ctx.userId = userId; },
  };
}
