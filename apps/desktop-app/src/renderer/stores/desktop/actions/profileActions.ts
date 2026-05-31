import type { ProfileDefinition, ProfileSettings } from "../../../../main/types";
import { createId, toPlain } from "../helpers";
import { DEFAULT_PROFILE_TEMPLATE } from "../defaults";
import type { DesktopStoreThis } from "../types";

export function setEditingProfile(this: DesktopStoreThis, profileId: string) {
  if (!this.settings) {
    return;
  }
  const exists = this.settings.profiles.some((profile) => profile.id === profileId);
  this.editingProfileId = exists ? profileId : this.settings.defaultProfileId;
}

export function updateProfileSetting<Key extends keyof ProfileSettings>(
  this: DesktopStoreThis,
  key: Key,
  value: ProfileSettings[Key]
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
    settings: toPlain(DEFAULT_PROFILE_TEMPLATE)
  };
  this.editingProfileId = newProfile.id;
  const insertIndex = Math.max(0, this.settings.profiles.length - 1);
  this.updateSettings({
    profiles: [
      ...this.settings.profiles.slice(0, insertIndex),
      newProfile,
      ...this.settings.profiles.slice(insertIndex)
    ]
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
    settings: toPlain(existing.settings)
  };
  this.editingProfileId = copy.id;
  const insertIndex = Math.max(0, this.settings.profiles.length - 1);
  this.updateSettings({
    profiles: [
      ...this.settings.profiles.slice(0, insertIndex),
      copy,
      ...this.settings.profiles.slice(insertIndex)
    ]
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
  this.editingProfileId = this.settings.defaultProfileId;
  this.updateSettings({
    profiles: nextProfiles,
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
  const lastSortableIndex = profiles.length - 1;
  const targetIndex = Math.min(toIndex, lastSortableIndex);
  profiles.splice(targetIndex, 0, moved);
  this.updateSettings({
    profiles
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
  addProfile,
  duplicateProfile,
  deleteProfile,
  reorderProfile,
  addPriority,
  removePriority,
  reorderPriority
};
