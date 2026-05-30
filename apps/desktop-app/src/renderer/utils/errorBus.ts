interface ReportedError {
  context: string;
  message: string;
  error: unknown;
}

type ErrorListener = (error: ReportedError) => void;

const listeners = new Set<ErrorListener>();

/**
 * Report an error from the renderer. Logs to console AND dispatches to any
 * subscribed listeners (e.g. a toast banner in App.vue). Use for failures
 * the user should know about.
 */
export function reportError(error: unknown, context: string): void {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  console.error(`[Renderer][${context}]`, error);
  const payload: ReportedError = { context, message, error };
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (listenerError) {
      console.error("[Renderer][errorBus] listener failed", listenerError);
    }
  }
}

/**
 * Explicitly mark an error as safe to ignore. Requires a reason so reviewers
 * can audit why silent failure is acceptable here.
 */
export function swallow(error: unknown, context: string, reason: string): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(`[Renderer][swallow:${context}] ${reason}`, error);
  }
}

export function onError(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
