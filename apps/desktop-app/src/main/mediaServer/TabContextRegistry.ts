export type TabMediaServerContext = {
  itemId: string | null;
  sessionId: string | null;
  serverConfigId: string | null;
};

export class TabContextRegistry {
  private readonly tabMediaServerContexts = new Map<number, TabMediaServerContext>();

  get(tabId: number | null): TabMediaServerContext | null {
    if (tabId === null) {
      return null;
    }
    return this.tabMediaServerContexts.get(tabId) ?? null;
  }

  update(tabId: number, updates: Partial<TabMediaServerContext>): TabMediaServerContext {
    const previous = this.tabMediaServerContexts.get(tabId) ?? {
      itemId: null,
      sessionId: null,
      serverConfigId: null
    };
    const next: TabMediaServerContext = {
      ...previous,
      ...updates
    };
    this.tabMediaServerContexts.set(tabId, next);
    return next;
  }

  clear(tabId: number) {
    this.tabMediaServerContexts.delete(tabId);
  }

  entries(): IterableIterator<[number, TabMediaServerContext]> {
    return this.tabMediaServerContexts.entries();
  }
}
