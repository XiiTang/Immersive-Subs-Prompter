import { AppReleaseService, type AppReleaseServiceOptions } from "./appReleaseService.js";
import { getElectronAutoUpdater } from "./releases/electronUpdater.js";

export type AppReleaseRuntimeOptions = Omit<AppReleaseServiceOptions, "updater">;

export function createAppReleaseService(options: AppReleaseRuntimeOptions): AppReleaseService {
  return new AppReleaseService({
    ...options,
    updater: getElectronAutoUpdater()
  });
}
