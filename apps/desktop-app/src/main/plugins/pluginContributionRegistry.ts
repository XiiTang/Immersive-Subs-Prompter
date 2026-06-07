import type { SubtitleTrack } from "../types.js";

export interface WordLookupProvider {
  lookup(token: string): Promise<unknown>;
}

export interface TranscriptionProviderContext {
  videoUrl: string;
  config: Record<string, unknown>;
}

export interface TranscriptionProvider {
  transcribe(context: TranscriptionProviderContext): Promise<SubtitleTrack>;
}

export interface MediaSourceAdapter {
  handleConnectionMessage?(message: unknown): Promise<unknown>;
  handleSettingsUpdated?(config: Record<string, unknown>): Promise<void>;
  stop?(): Promise<void>;
}

interface PluginContributionSet {
  wordLookup: WordLookupProvider | null;
  transcription: TranscriptionProvider | null;
  mediaSource: MediaSourceAdapter | null;
}

function createEmptySet(): PluginContributionSet {
  return {
    wordLookup: null,
    transcription: null,
    mediaSource: null
  };
}

export class PluginContributionRegistry {
  private readonly contributions = new Map<string, PluginContributionSet>();

  registerWordLookupProvider(pluginKey: string, provider: WordLookupProvider): void {
    this.getOrCreate(pluginKey).wordLookup = provider;
  }

  registerTranscriptionProvider(pluginKey: string, provider: TranscriptionProvider): void {
    this.getOrCreate(pluginKey).transcription = provider;
  }

  registerMediaSourceAdapter(pluginKey: string, adapter: MediaSourceAdapter): void {
    this.getOrCreate(pluginKey).mediaSource = adapter;
  }

  unregisterPlugin(pluginKey: string): boolean {
    return this.contributions.delete(pluginKey);
  }

  getTranscriptionProvider(): { pluginKey: string; provider: TranscriptionProvider } | null {
    for (const [pluginKey, set] of this.contributions.entries()) {
      if (set.transcription) {
        return { pluginKey, provider: set.transcription };
      }
    }
    return null;
  }

  getMediaSourceAdapters(): Array<{ pluginKey: string; adapter: MediaSourceAdapter }> {
    return Array.from(this.contributions.entries())
      .filter((entry): entry is [string, PluginContributionSet & { mediaSource: MediaSourceAdapter }] => !!entry[1].mediaSource)
      .map(([pluginKey, set]) => ({ pluginKey, adapter: set.mediaSource }));
  }

  getWordLookupProvider(): { pluginKey: string; provider: WordLookupProvider } | null {
    for (const [pluginKey, set] of this.contributions.entries()) {
      if (set.wordLookup) {
        return { pluginKey, provider: set.wordLookup };
      }
    }
    return null;
  }

  async lookupWord(token: string): Promise<unknown> {
    const provider = this.getWordLookupProvider();
    if (!provider) {
      throw new Error("No enabled word lookup provider.");
    }
    return provider.provider.lookup(token);
  }

  private getOrCreate(pluginKey: string): PluginContributionSet {
    const current = this.contributions.get(pluginKey);
    if (current) {
      return current;
    }
    const next = createEmptySet();
    this.contributions.set(pluginKey, next);
    return next;
  }
}
