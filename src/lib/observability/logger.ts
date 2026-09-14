import "server-only";

const blockedKeys = /body|content|token|secret|authorization|cookie|password|credential/i;

type LogValue = string | number | boolean | null | undefined;
type LogContext = Record<string, LogValue>;

function clean(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, blockedKeys.test(key) ? "[REDACTED]" : value]),
  );
}

function write(level: "info" | "warn" | "error", event: string, context: LogContext = {}) {
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, service: "gated-web", event, ...clean(context) });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export const logger = {
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),
};

export function requestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
