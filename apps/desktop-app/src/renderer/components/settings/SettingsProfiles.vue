<template>
  <UiSection :title="t('section-profiles', 'Profiles')">
    <div class="settings-split">
      <ProfileList
        :profiles="profiles"
        :rules="rules"
        :editing-profile-id="editingProfileId"
        :active-profile-id="activeProfileId"
        :default-profile-id="defaultProfileId"
        :can-delete="canDeleteProfile"
        @add="store.addProfile()"
        @duplicate="store.duplicateProfile()"
        @delete="deleteEditingProfile"
        @select="(id) => store.setEditingProfile(id)"
        @reorder="(fromIndex, toIndex) => store.reorderProfile(fromIndex, toIndex)"
      />
      <div class="settings-split__editor" v-if="editingProfile">
        <UiField id="profile-name" :label="t('profile-name-label', 'Profile Name')">
          <UiInput v-model="profileName" autocomplete="off" />
        </UiField>
        <SubtitleStyleFields />
        <ColorSchemeGrid />
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
          :empty-text="t('priority-empty', 'No priorities yet')"
          :add-button-label="t('button-add', 'Add')"
          :remove-label="t('priority-remove', 'Remove priority')"
          :error="primaryPriorityError"
          :doc-url="regexDocUrl"
          :doc-link-text="t('priority-regex-examples', '查看正则示例')"
          :is-drag-over="isPriorityDragOver"
          :on-drag-start="onPriorityDragStart"
          :on-drag-enter="onPriorityDragEnter"
          :on-drag-leave="onPriorityDragLeave"
          :on-drop="onPriorityDrop"
          :on-drag-end="onPriorityDragEnd"
          :on-list-drop="onPriorityListDrop"
          @add="addPriority('primary')"
          @remove="(value) => removePriority('primary', value)"
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
          :empty-text="t('priority-empty', 'No priorities yet')"
          :add-button-label="t('button-add', 'Add')"
          :remove-label="t('priority-remove', 'Remove priority')"
          :error="secondaryPriorityError"
          :is-drag-over="isPriorityDragOver"
          :on-drag-start="onPriorityDragStart"
          :on-drag-enter="onPriorityDragEnter"
          :on-drag-leave="onPriorityDragLeave"
          :on-drop="onPriorityDrop"
          :on-drag-end="onPriorityDragEnd"
          :on-list-drop="onPriorityListDrop"
          @add="addPriority('secondary')"
          @remove="(value) => removePriority('secondary', value)"
        />

        <UiField id="yt-dlp-args" :label="t('yt-dlp-args-label', 'yt-dlp Arguments')" :hint="t('yt-dlp-args-hint', 'Leave blank to use default arguments')">
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
import ProfileList from "./profiles/ProfileList.vue";
import SubtitleStyleFields from "./profiles/SubtitleStyleFields.vue";
import ColorSchemeGrid from "./profiles/ColorSchemeGrid.vue";
import PriorityEditor from "./profiles/PriorityEditor.vue";
import ProfileUrlRules from "./profiles/ProfileUrlRules.vue";
import { UiField, UiInput, UiSection, UiTextarea } from "../ui";
import {
  usePriorityDragDrop,
  type PriorityRole
} from "./profiles/composables/usePriorityDragDrop";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const profiles = computed(() => store.settings?.profiles ?? []);
const rules = computed(() => store.settings?.rules ?? []);
const editingProfile = computed(() => store.editingProfile);
const editingProfileId = computed(() => store.editingProfile?.id ?? null);
const activeProfileId = computed(() => store.activeProfileId);
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

const profileName = computed({
  get: () => editingProfile.value?.name ?? "",
  set: (value: string) => store.updateProfileMeta({ name: value })
});

const ytDlpArgs = computed({
  get: () => store.editingProfileSettings.ytDlpArgs,
  set: (value: string) => store.updateProfileSetting("ytDlpArgs", value)
});

const primaryPriority = computed(() => store.editingProfileSettings.primarySubtitlePriority ?? []);
const secondaryPriority = computed(() => store.editingProfileSettings.secondarySubtitlePriority ?? []);
const primaryPriorityInput = ref("");
const secondaryPriorityInput = ref("");
const primaryPriorityError = computed(() => getPriorityRegexError(primaryPriorityInput.value));
const secondaryPriorityError = computed(() => getPriorityRegexError(secondaryPriorityInput.value));
const regexDocUrl =
  "https://github.com/XiiTang/Immersive-Subs-Prompter/blob/main/docs/subtitle-priority-regex.md";

const {
  onPriorityDragStart,
  onPriorityDragEnter,
  onPriorityDragLeave,
  onPriorityDrop,
  onPriorityListDrop,
  onPriorityDragEnd,
  isPriorityDragOver
} = usePriorityDragDrop({
  reorderPriority: (role, fromIndex, toIndex) => store.reorderPriority(role, fromIndex, toIndex),
  getListLength: (role: PriorityRole) =>
    role === "primary" ? primaryPriority.value.length : secondaryPriority.value.length
});

function deleteEditingProfile() {
  if (editingProfileId.value) {
    store.deleteProfile(editingProfileId.value);
  }
}

function addPriority(role: PriorityRole) {
  const input = role === "primary" ? primaryPriorityInput : secondaryPriorityInput;
  store.addPriority(role, input.value);
  input.value = "";
}

function removePriority(role: PriorityRole, value: string) {
  store.removePriority(role, value);
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
