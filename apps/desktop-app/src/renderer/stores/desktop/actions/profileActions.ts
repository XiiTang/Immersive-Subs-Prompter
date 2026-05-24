import type { ProfileDefinition, ProfileSettings } from "../../../../main/types";
import { createId, mergePartial } from "../helpers";
import { DEFAULT_PROFILE_TEMPLATE } from "../defaults";
import type { DesktopStoreThis } from "../types";
import type { UpdateSettingsOptions } from "./settingsActions";

function keepFallbackLast(profiles: ProfileDefinition[], fallbackProfileId: string): ProfileDefinition[] {
  const fallbackProfile = profiles.find((profile) => profile.id === fallbackProfileId);
  return fallbackProfile
    ? [...profiles.filter((profile) => profile.id !== fallbackProfile.id), fallbackProfile]
    : profiles;
}

function appendBeforeFallback(
  profiles: ProfileDefinition[],
  profile: ProfileDefinition,
  fallbackProfileId: string
): ProfileDefinition[] {
  return keepFallbackLast([...profiles, profile], fallbackProfileId);
}

export function setEditingProfile(this: DesktopStoreThis, profileId: string) {
  if (!this.settings) {
    return;
  }
  const exists = this.settings.profiles.some((profile) => profile.id === profileId);
  this.editingProfileId = exists ? profileId : this.settings.defaultProfileId ?? this.settings.profiles[0].id;
}

export function updateProfileSetting<Key extends keyof ProfileSettings>(
  this: DesktopStoreThis,
  key: Key,
  value: ProfileSettings[Key],
  options: UpdateSettingsOptions = {}
) {
  if (!this.settings || !this.editingProfileId) {
    return;
  }
  const nextProfiles = this.settings.profiles.map((profile) =>
    profile.id === this.editingProfileId
      ? {
        ...profile,
        settings: {
          ...profile.settings,
          [key]: value
        }
      }
      : profile
  );
  this.updateSettings({ profiles: nextProfiles }, options);
}

export function updateProfileMeta(this: DesktopStoreThis, partial: Partial<ProfileDefinition>) {
  if (!this.settings || !this.editingProfileId) {
    return;
  }
  const nextProfiles = this.settings.profiles.map((profile) =>
    profile.id === this.editingProfileId ? { ...profile, ...partial } : profile
  );
  this.updateSettings({ profiles: nextProfiles });
}

export function addProfile(this: DesktopStoreThis) {
  if (!this.settings) {
    return;
  }
  const newProfile: ProfileDefinition = {
    id: createId("profile"),
    name: `Profile ${this.settings.profiles.length + 1}`,
    description: null,
    settings: { ...DEFAULT_PROFILE_TEMPLATE }
  };
  this.editingProfileId = newProfile.id;
  this.updateSettings({
    profiles: appendBeforeFallback(this.settings.profiles, newProfile, this.settings.defaultProfileId)
  });
}

export function duplicateProfile(this: DesktopStoreThis) {
  if (!this.settings || !this.editingProfileId) {
    return;
  }
  const existing = this.settings.profiles.find((profile) => profile.id === this.editingProfileId);
  if (!existing) {
    return;
  }
  const copy: ProfileDefinition = {
    ...existing,
    id: createId("profile"),
    name: `${existing.name} Copy`,
    settings: mergePartial(existing.settings, {})
  };
  this.editingProfileId = copy.id;
  this.updateSettings({
    profiles: appendBeforeFallback(this.settings.profiles, copy, this.settings.defaultProfileId)
  });
}

export function deleteProfile(this: DesktopStoreThis, profileId: string) {
  if (!this.settings) {
    return;
  }
  if (profileId === this.settings.defaultProfileId) {
    console.warn("[Renderer] Cannot delete the fallback profile.");
    return;
  }
  if (this.settings.profiles.length <= 1) {
    console.warn("[Renderer] At least one profile must remain.");
    return;
  }
  const nextProfiles = this.settings.profiles.filter((profile) => profile.id !== profileId);
  const orderedProfiles = keepFallbackLast(nextProfiles, this.settings.defaultProfileId);
  this.editingProfileId = orderedProfiles[0]?.id ?? this.settings.defaultProfileId ?? null;
  this.updateSettings({
    profiles: orderedProfiles,
    rules: this.settings.rules.filter((rule) => rule.profileId !== profileId)
  });
}

export function reorderProfile(this: DesktopStoreThis, fromIndex: number, toIndex: number) {
  if (!this.settings || fromIndex === toIndex) {
    return;
  }
  const profiles = [...this.settings.profiles];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= profiles.length ||
    toIndex >= profiles.length
  ) {
    return;
  }
  const [moved] = profiles.splice(fromIndex, 1);
  if (!moved || moved.id === this.settings.defaultProfileId) {
    return;
  }
  const fallbackProfile = profiles.find((profile) => profile.id === this.settings?.defaultProfileId);
  const sortableProfiles = profiles.filter((profile) => profile.id !== this.settings?.defaultProfileId);
  const targetIndex = Math.min(toIndex, sortableProfiles.length);
  sortableProfiles.splice(targetIndex, 0, moved);
  this.updateSettings({
    profiles: fallbackProfile ? [...sortableProfiles, fallbackProfile] : sortableProfiles
  });
}

export function addPriority(this: DesktopStoreThis, role: "primary" | "secondary", value: string) {
  const normalized = value.trim();
  if (!this.settings || !this.editingProfileId || !normalized) {
    return;
  }
  const key = role === "primary" ? "primarySubtitlePriority" : "secondarySubtitlePriority";
  const current = this.editingProfileSettings[key] ?? [];
  if (current.some((entry) => entry === normalized)) {
    return;
  }
  const next = [...current, normalized];
  this.updateProfileSetting(key as keyof ProfileSettings, next as any);
}

export function removePriority(this: DesktopStoreThis, role: "primary" | "secondary", value: string) {
  if (!this.settings || !this.editingProfileId) {
    return;
  }
  const key = role === "primary" ? "primarySubtitlePriority" : "secondarySubtitlePriority";
  const current = this.editingProfileSettings[key] ?? [];
  const next = current.filter((entry) => entry !== value);
  this.updateProfileSetting(key as keyof ProfileSettings, next as any);
}

export function reorderPriority(
  this: DesktopStoreThis,
  role: "primary" | "secondary",
  fromIndex: number,
  toIndex: number
) {
  if (!this.settings || !this.editingProfileId) {
    return;
  }
  const key = role === "primary" ? "primarySubtitlePriority" : "secondarySubtitlePriority";
  const list = [...(this.editingProfileSettings[key] ?? [])];
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return;
  }
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);
  this.updateProfileSetting(key as keyof ProfileSettings, list as any);
}

export const profileActions = {
  setEditingProfile,
  updateProfileSetting,
  updateProfileMeta,
  addProfile,
  duplicateProfile,
  deleteProfile,
  reorderProfile,
  addPriority,
  removePriority,
  reorderPriority
};
