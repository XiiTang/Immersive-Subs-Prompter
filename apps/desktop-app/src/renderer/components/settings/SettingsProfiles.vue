<template>
  <UiSection :title="t('section-profiles')">
    <div class="settings-split">
      <ProfileList
        :profiles="profiles"
        :rules="rules"
        :editing-profile-id="editingProfileId"
        :default-profile-id="defaultProfileId"
        :can-delete="canDeleteProfile"
        @add="store.addProfile()"
        @duplicate="store.duplicateProfile()"
        @delete="deleteEditingProfile"
        @select="(id) => store.setEditingProfile(id)"
        @reorder="(fromIndex, toIndex) => store.reorderProfile(fromIndex, toIndex)"
        @rename="updateProfileName"
        @toggle-enabled="(id, enabled) => store.toggleProfileEnabled(id, enabled)"
      />
      <div class="settings-split__editor" v-if="editingProfile">
        <ProfileUrlRules
          :profile-id="editingProfile.id"
          :is-default-profile="editingProfile.id === defaultProfileId"
          :rules="editingProfileRules"
        />
        <SubtitleStyleFields @preview-settings-draft="updateSubtitleStylePreviewDraft" />
        <SubtitleStylePreview :settings-draft="previewProfileSettingsDraft" />

        <PriorityEditor
          role="primary"
          :items="primaryPriority"
          v-model="primaryPriorityInput"
          :label="t('primary-priority-label')"
          :hint="
            t('primary-priority-hint')
          "
          :placeholder="t('primary-priority-placeholder')"
          :error="primaryPriorityError"
          :remove-label="t('priority-remove')"
          @add="addPriority('primary')"
          @remove="(value) => store.removePriority('primary', value)"
          @reorder="(fromIndex, toIndex) => store.reorderPriority('primary', fromIndex, toIndex)"
        />

        <PriorityEditor
          role="secondary"
          :items="secondaryPriority"
          v-model="secondaryPriorityInput"
          :label="t('secondary-priority-label')"
          :hint="
            t('secondary-priority-hint')
          "
          :placeholder="t('secondary-priority-placeholder')"
          :error="secondaryPriorityError"
          :remove-label="t('priority-remove')"
          @add="addPriority('secondary')"
          @remove="(value) => store.removePriority('secondary', value)"
          @reorder="(fromIndex, toIndex) => store.reorderPriority('secondary', fromIndex, toIndex)"
        />

        <UiField id="yt-dlp-args" :label="t('yt-dlp-args-label')">
          <UiTextarea v-model="ytDlpArgs" :rows="3" />
        </UiField>
      </div>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { isValidRegex } from "../../../common/regex.js";
import type { ProfileSettings } from "../../../main/types";
import ProfileList from "./profiles/ProfileList.vue";
import SubtitleStyleFields from "./profiles/SubtitleStyleFields.vue";
import SubtitleStylePreview from "./profiles/SubtitleStylePreview.vue";
import PriorityEditor from "./profiles/PriorityEditor.vue";
import ProfileUrlRules from "./profiles/ProfileUrlRules.vue";
import { UiField, UiSection, UiTextarea } from "../ui";

type PriorityRole = "primary" | "secondary";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const profiles = computed(() => store.settings?.profiles ?? []);
const rules = computed(() => store.settings?.rules ?? []);
const editingProfile = computed(() => store.editingProfile);
const editingProfileId = computed(() => store.editingProfile?.id ?? null);
const defaultProfileId = computed(() => store.settings?.defaultProfileId ?? null);
const editingProfileRules = computed(() =>
  editingProfile.value ? rules.value.filter((rule) => rule.profileId === editingProfile.value?.id) : []
);
const canDeleteProfile = computed(
  () =>
    Boolean(editingProfileId.value) &&
    editingProfileId.value !== defaultProfileId.value &&
    (profiles.value.length ?? 0) > 1
);

const ytDlpArgs = computed({
  get: () => store.editingProfileSettings.ytDlpArgs,
  set: (value: string) => store.updateProfileSetting("ytDlpArgs", value)
});

const primaryPriority = computed(() => store.editingProfileSettings.primarySubtitlePriority ?? []);
const secondaryPriority = computed(() => store.editingProfileSettings.secondarySubtitlePriority ?? []);
const primaryPriorityInput = ref("");
const secondaryPriorityInput = ref("");
const previewProfileSettingsDraft = ref<Partial<ProfileSettings> | null>(null);
const primaryPriorityError = computed(() => getPriorityRegexError(primaryPriorityInput.value));
const secondaryPriorityError = computed(() => getPriorityRegexError(secondaryPriorityInput.value));

function deleteEditingProfile() {
  if (editingProfileId.value) {
    store.deleteProfile(editingProfileId.value);
  }
}

function updateProfileName(profileId: string, name: string) {
  if (!store.settings) {
    return;
  }
  const nextName = name.trim();
  if (!nextName.length) {
    return;
  }
  const profiles = store.settings.profiles.map((profile) =>
    profile.id === profileId ? { ...profile, name: nextName } : profile
  );
  store.updateSettings({ profiles });
}

function updateSubtitleStylePreviewDraft(settingsDraft: Partial<ProfileSettings>) {
  previewProfileSettingsDraft.value = settingsDraft;
}

function addPriority(role: PriorityRole) {
  const input = role === "primary" ? primaryPriorityInput : secondaryPriorityInput;
  if (getPriorityRegexError(input.value)) {
    return;
  }
  store.addPriority(role, input.value);
  input.value = "";
}

function getPriorityRegexError(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  return isValidRegex(normalized) ? null : t("priority-regex-invalid");
}
</script>
