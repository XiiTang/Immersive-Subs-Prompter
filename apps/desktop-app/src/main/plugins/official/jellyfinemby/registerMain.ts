import type { PluginMainContribution } from "../../pluginManifest.js";

interface JellyfinembyPluginController {
  activate: () => void;
  deactivate: () => void;
}

export interface JellyfinembyPluginContext {
  mediaServerController: JellyfinembyPluginController;
}

export function registerJellyfinembyPluginMain(context: JellyfinembyPluginContext): PluginMainContribution {
  context.mediaServerController.activate();

  return {
    dispose: () => context.mediaServerController.deactivate()
  };
}
