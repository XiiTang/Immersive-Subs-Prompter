import type { PluginMainContribution } from "@immersive-subs/plugin-sdk";
import type { WordLookupPluginConfig } from "./wordLookupTypes.js";
import { WordLookupService } from "./WordLookupService.js";

export interface WordLookupPluginContext {
  getWordLookupSettings: () => WordLookupPluginConfig;
}

export function registerWordLookupPluginMain(context: WordLookupPluginContext): PluginMainContribution {
  const service = new WordLookupService(context.getWordLookupSettings);
  void service.refresh();

  return {
    commands: {
      lookup: async (token: unknown) => service.lookup(typeof token === "string" ? token : ""),
      refresh: async () => service.refresh(),
      getStatus: async () => service.getStatus()
    }
  };
}
