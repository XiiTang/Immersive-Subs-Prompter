import { createLogger } from "./logger.js";

const fallbackLog = createLogger("errors");

export interface ReportErrorOptions {
  scope?: string;
  level?: "warn" | "error";
  extra?: Record<string, unknown>;
}

/**
 * Report an error through the shared logger with a stable structured shape.
 * Use for failures that the operator should see in the log stream.
 */
export function reportError(
  error: unknown,
  context: string,
  options: ReportErrorOptions = {}
): void {
  const log = options.scope ? createLogger(options.scope) : fallbackLog;
  const level = options.level ?? "error";
  const payload: Record<string, unknown> = { context, ...(options.extra ?? {}) };
  if (error instanceof Error) {
    payload.name = error.name;
    payload.message = error.message;
    payload.stack = error.stack;
  } else {
    payload.value = error;
  }
  log[level](`[${context}]`, payload);
}

/**
 * Explicitly mark an error as safe to ignore. Requires a human-readable reason
 * so reviewers can audit why silent failure is acceptable here.
 *
 * Example:
 *   await fsPromises.unlink(path).catch((err) => swallow(err, "cache.cleanup", "file already removed"));
 */
export function swallow(error: unknown, context: string, reason: string): void {
  fallbackLog.debug(`[swallow:${context}] ${reason}`, {
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : error
  });
}
