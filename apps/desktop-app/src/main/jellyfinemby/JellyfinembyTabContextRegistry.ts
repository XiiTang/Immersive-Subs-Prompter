export type JellyfinembyTabContext = {
  itemId: string | null;
  sessionId: string | null;
  serverConfigId: string | null;
};

export class JellyfinembyTabContextRegistry {
  private readonly contexts = new Map<number, JellyfinembyTabContext>();

  get(tabId: number | null): JellyfinembyTabContext | null {
    if (tabId === null) {
      return null;
    }
    return this.contexts.get(tabId) ?? null;
  }

  update(tabId: number, updates: Partial<JellyfinembyTabContext>): JellyfinembyTabContext {
    const previous = this.contexts.get(tabId) ?? {
      itemId: null,
      sessionId: null,
      serverConfigId: null
    };
    const next: JellyfinembyTabContext = {
      ...previous,
      ...updates
    };
    this.contexts.set(tabId, next);
    return next;
  }

  clear(tabId: number) {
    this.contexts.delete(tabId);
  }

  clearAll() {
    this.contexts.clear();
  }

  entries(): IterableIterator<[number, JellyfinembyTabContext]> {
    return this.contexts.entries();
  }
}
