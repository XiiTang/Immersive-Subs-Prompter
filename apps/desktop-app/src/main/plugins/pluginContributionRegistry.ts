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

  registerWordLookupProvider(pluginId: string, provider: WordLookupProvider): void {
    this.getOrCreate(pluginId).wordLookup = provider;
  }

  registerTranscriptionProvider(pluginId: string, provider: TranscriptionProvider): void {
    this.getOrCreate(pluginId).transcription = provider;
  }

  registerMediaSourceAdapter(pluginId: string, adapter: MediaSourceAdapter): void {
    this.getOrCreate(pluginId).mediaSource = adapter;
  }

  unregisterPlugin(pluginId: string): boolean {
    return this.contributions.delete(pluginId);
  }

  getTranscriptionProvider(): { pluginId: string; provider: TranscriptionProvider } | null {
    for (const [pluginId, set] of this.contributions.entries()) {
      if (set.transcription) {
        return { pluginId, provider: set.transcription };
      }
    }
    return null;
  }

  getMediaSourceAdapters(): Array<{ pluginId: string; adapter: MediaSourceAdapter }> {
    return Array.from(this.contributions.entries())
      .filter((entry): entry is [string, PluginContributionSet & { mediaSource: MediaSourceAdapter }] => !!entry[1].mediaSource)
      .map(([pluginId, set]) => ({ pluginId, adapter: set.mediaSource }));
  }

  getWordLookupProvider(): { pluginId: string; provider: WordLookupProvider } | null {
    for (const [pluginId, set] of this.contributions.entries()) {
      if (set.wordLookup) {
        return { pluginId, provider: set.wordLookup };
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

  private getOrCreate(pluginId: string): PluginContributionSet {
    const current = this.contributions.get(pluginId);
    if (current) {
      return current;
    }
    const next = createEmptySet();
    this.contributions.set(pluginId, next);
    return next;
  }
}
