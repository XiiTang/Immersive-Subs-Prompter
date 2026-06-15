import type { FeatureId } from "../../../../common/featureDefaults";
import type { AppSettings, FeatureSettings } from "../../../../main/types";
import type { DesktopStoreThis } from "../types";

export async function setFeatureEnabled(
  this: DesktopStoreThis,
  featureId: FeatureId,
  enabled: boolean
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features[featureId];
  await this.updateSettings({
    features: {
      [featureId]: {
        enabled,
        config: feature.config
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}

export async function setFeatureConfig<FeatureKey extends FeatureId>(
  this: DesktopStoreThis,
  featureId: FeatureKey,
  config: Partial<FeatureSettings[FeatureKey]["config"]>
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features[featureId];
  await this.updateSettings({
    features: {
      [featureId]: {
        enabled: feature.enabled,
        config: {
          ...feature.config,
          ...config
        }
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}

export const featureActions = {
  setFeatureEnabled,
  setFeatureConfig
};
