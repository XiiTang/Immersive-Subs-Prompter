import type { AppSettings, GlobalSettings, NetworkSettings } from "../../../../main/types";
import { reportError } from "../../../utils/errorBus";
import { toPlain } from "../helpers";
import type { DesktopStoreThis } from "../types";

function mergeSettingsPatch<T>(current: T, patch: Partial<T>): T {
  const base = { ...(current as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const currentValue = base[key];
    if (Array.isArray(value)) {
      base[key] = [...value];
    } else if (value && typeof value === "object") {
      const currentObject =
        currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
          ? currentValue
          : {};
      base[key] = mergeSettingsPatch(currentObject, value as Record<string, unknown>);
    } else if (value !== undefined) {
      base[key] = value;
    }
  }
  return base as T;
}

export async function updateSettings(
  this: DesktopStoreThis,
  partial: Partial<AppSettings>
) {
  if (!this.settings) {
    return;
  }
  const previous = toPlain(this.settings);
  const payload = toPlain(partial);
  this.settings = mergeSettingsPatch(this.settings, payload);
  try {
    this.settings = await window.usp.updateSettings(payload);
  } catch (error) {
    this.settings = previous;
    reportError(error, "settings.update");
  }
}

export function updateGlobalSetting<Key extends keyof GlobalSettings>(
  this: DesktopStoreThis,
  key: Key,
  value: GlobalSettings[Key]
) {
  if (!this.settings) {
    return;
  }
  const nextGlobal = { ...this.settings.global, [key]: value } as GlobalSettings;
  this.updateSettings({ global: nextGlobal });
}

export function updateNetworkSetting<Key extends keyof NetworkSettings>(
  this: DesktopStoreThis,
  key: Key,
  value: NetworkSettings[Key]
) {
  if (!this.settings) {
    return;
  }
  const nextNetwork = { ...this.settings.network, [key]: value } as NetworkSettings;
  this.updateSettings({ network: nextNetwork });
}

export const settingsActions = {
  updateSettings,
  updateGlobalSetting,
  updateNetworkSetting
};
