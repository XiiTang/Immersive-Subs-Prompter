<template>
  <UiSection :title="t('section-profiles', 'Profiles')">
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
      />
      <div class="settings-split__editor" v-if="editingProfile">
        <SubtitleStyleFields />
        <ColorSchemeGrid />
        <SubtitleStylePreview />
        <ProfileUrlRules
          :profile-id="editingProfile.id"
          :is-default-profile="editingProfile.id === defaultProfileId"
          :rules="editingProfileRules"
        />

        <PriorityEditor
          role="primary"
          :items="primaryPriority"
          v-model="primaryPriorityInput"
          :label="t('primary-priority-label', 'Primary Subtitle Priority')"
          :hint="
            t(
              'primary-priority-hint',
              'Use regular expressions to match subtitle filenames; drag to reprioritize'
            )
          "
          :placeholder="t('primary-priority-placeholder', 'e.g.: en or zh-Hans')"
          :error="primaryPriorityError"
          :doc-url="regexDocUrl"
          :remove-label="t('priority-remove', 'Remove priority')"
          @add="addPriority('primary')"
          @remove="(value) => store.removePriority('primary', value)"
          @reorder="(fromIndex, toIndex) => store.reorderPriority('primary', fromIndex, toIndex)"
          @doc-link-click="openRegexDoc"
        />

        <PriorityEditor
          role="secondary"
          :items="secondaryPriority"
          v-model="secondaryPriorityInput"
          :label="t('secondary-priority-label', 'Secondary Subtitle Priority')"
          :hint="
            t(
              'secondary-priority-hint',
              'Use regular expressions to match subtitle filenames; drag to reprioritize'
            )
          "
          :placeholder="t('secondary-priority-placeholder', 'e.g.: en or zh-Hans')"
          :error="secondaryPriorityError"
          :remove-label="t('priority-remove', 'Remove priority')"
          @add="addPriority('secondary')"
          @remove="(value) => store.removePriority('secondary', value)"
          @reorder="(fromIndex, toIndex) => store.reorderPriority('secondary', fromIndex, toIndex)"
        />

        <UiField id="yt-dlp-args" :label="t('yt-dlp-args-label', 'yt-dlp Arguments')">
          <UiTextarea v-model="ytDlpArgs" :rows="3" :placeholder="defaultYtDlpArgs" />
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
import { DEFAULT_YTDLP_ARGS } from "../../../common/ytdlpDefaults.js";
import ProfileList from "./profiles/ProfileList.vue";
import SubtitleStyleFields from "./profiles/SubtitleStyleFields.vue";
import ColorSchemeGrid from "./profiles/ColorSchemeGrid.vue";
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
const defaultYtDlpArgs = DEFAULT_YTDLP_ARGS;

const primaryPriority = computed(() => store.editingProfileSettings.primarySubtitlePriority ?? []);
const secondaryPriority = computed(() => store.editingProfileSettings.secondarySubtitlePriority ?? []);
const primaryPriorityInput = ref("");
const secondaryPriorityInput = ref("");
const primaryPriorityError = computed(() => getPriorityRegexError(primaryPriorityInput.value));
const secondaryPriorityError = computed(() => getPriorityRegexError(secondaryPriorityInput.value));
const regexDocUrl =
  "https://github.com/XiiTang/Immersive-Subs-Prompter/blob/main/docs/subtitle-priority-regex.md";

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

function addPriority(role: PriorityRole) {
  const input = role === "primary" ? primaryPriorityInput : secondaryPriorityInput;
  if (getPriorityRegexError(input.value)) {
    return;
  }
  store.addPriority(role, input.value);
  input.value = "";
}

async function openRegexDoc() {
  await window.usp.openExternal(regexDocUrl);
}

function getPriorityRegexError(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  return isValidRegex(normalized) ? null : t("priority-regex-invalid", "无效的正则表达式");
}
</script>
