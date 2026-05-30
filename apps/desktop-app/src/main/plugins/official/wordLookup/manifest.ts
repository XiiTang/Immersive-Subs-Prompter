import type { PluginManifest } from "../../pluginManifest.js";

export const WORD_LOOKUP_MANIFEST: PluginManifest = {
  id: "official.word-lookup",
  version: "1.0.0",
  displayName: "Word Lookup",
  description: "Look up subtitle tokens from a mounted JSONL word list.",
  settings: [
    {
      id: "official.word-lookup.settings",
      title: "Word Lookup"
    }
  ]
};
