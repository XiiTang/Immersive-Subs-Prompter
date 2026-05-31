/** Report an error from the renderer. Use for failures the user should know about. */
export function reportError(error: unknown, context: string): void {
  console.error(`[Renderer][${context}]`, error);
}
