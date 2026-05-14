import type { PluginMainContribution } from "@immersive-subs/plugin-sdk";

export interface JellyfinembyPluginController {
  activate: () => void;
  deactivate: () => void;
}

export interface JellyfinembyPluginContext {
  mediaServerController: JellyfinembyPluginController;
}

export function registerJellyfinembyPluginMain(context: JellyfinembyPluginContext): PluginMainContribution {
  context.mediaServerController.activate();

  return {
    commands: {},
    dispose: () => context.mediaServerController.deactivate()
  };
}
