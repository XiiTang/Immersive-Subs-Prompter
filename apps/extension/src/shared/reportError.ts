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
