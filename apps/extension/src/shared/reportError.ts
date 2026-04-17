/**
 * Minimal error reporting for the browser extension.
 * Logs to console with a stable prefix; on MV3 service workers this is
 * picked up by chrome://extensions.
 */
export function reportError(error: unknown, context: string): void {
  // eslint-disable-next-line no-console
  console.error(`[USP-ext][${context}]`, error);
}

/**
 * Explicitly mark an error as safe to ignore. Requires a reason so reviewers
 * can audit why silent failure is acceptable here.
 */
export function swallow(error: unknown, context: string, reason: string): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    // eslint-disable-next-line no-console
    console.debug(`[USP-ext][swallow:${context}] ${reason}`, error);
  }
}
