import type { AppSettings, GlobalSettings, NetworkSettings } from "../../../../main/types";
import { reportError } from "../../../utils/errorBus";
import { mergePartial, toPlain } from "../helpers";
import type { DesktopStoreThis } from "../types";

export function applySettingsPatch(this: DesktopStoreThis, partial: Partial<AppSettings>) {
  if (!this.settings) {
    return;
  }
  this.settings = mergePartial(this.settings, partial);
}

export async function updateSettings(this: DesktopStoreThis, partial: Partial<AppSettings>) {
  if (!this.settings) {
    return;
  }
  const previous = toPlain(this.settings);
  const payload = toPlain(partial);
  this.applySettingsPatch(payload);
  try {
    const next = await window.usp.updateSettings(payload);
    this.settings = next;
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
  applySettingsPatch,
  updateSettings,
  updateGlobalSetting,
  updateNetworkSetting
};
