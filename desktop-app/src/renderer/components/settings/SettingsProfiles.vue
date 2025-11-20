<template>
  <section class="settings-section">
    <h3 class="settings-section__title">{{ t("section-profiles", "Profiles") }}</h3>
    <div class="profile-settings">
      <div class="profile-settings__sidebar">
        <div class="profile-settings__actions">
          <span class="settings-field__label">{{ t("profile-list-label", "Profile List") }}</span>
          <div class="profile-settings__buttons">
            <button type="button" class="text-button" @click="store.addProfile()">
              {{ t("button-add", "Add") }}
            </button>
            <button type="button" class="text-button" @click="store.duplicateProfile()">
              {{ t("button-duplicate", "Duplicate") }}
            </button>
            <button
              type="button"
              class="text-button"
              :disabled="!canDeleteProfile"
              @click="deleteEditingProfile"
            >
              {{ t("button-delete", "Delete") }}
            </button>
          </div>
        </div>
        <div class="profile-list">
          <template v-if="profiles.length">
            <button
              v-for="profile in profiles"
              :key="profile.id"
              type="button"
              class="profile-list__item"
              :class="{ 'is-selected': profile.id === editingProfileId }"
              @click="store.setEditingProfile(profile.id)"
            >
              <span class="profile-list__name">{{ profile.name }}</span>
              <span v-if="profile.id === defaultProfileId" class="profile-list__badge">
                {{ t("default-badge", "Default") }}
              </span>
            </button>
          </template>
          <div v-else class="profile-list__empty">{{ t("profile-empty", "No profiles") }}</div>
        </div>
        <button
          type="button"
          class="text-button profile-settings__default"
          :disabled="!editingProfile || editingProfile.id === defaultProfileId"
          @click="setDefaultProfile"
        >
          {{ t("button-set-default", "Set as Default") }}
        </button>
      </div>
      <div class="profile-settings__editor" v-if="editingProfile">
        <label class="settings-field">
          <span class="settings-field__label">{{ t("profile-name-label", "Profile Name") }}</span>
          <input type="text" v-model="profileName" autocomplete="off" />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("subtitle-font-label", "Subtitle Font") }}</span>
          <input
            type="text"
            v-model="subtitleFontFamily"
            placeholder="e.g.: LXGW WenKai, sans-serif"
            autocomplete="off"
          />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("subtitle-font-size-label", "Subtitle Font Size") }}</span>
          <input type="number" min="10" max="48" step="1" v-model.number="subtitleFontSize" />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">
            {{ t("subtitle-autoscroll-label", "Auto-scroll Restore Time (seconds)") }}
          </span>
          <input type="number" min="1" max="60" step="1" v-model.number="subtitleAutoScrollTimeout" />
          <span class="settings-field__hint">
            {{ t("subtitle-autoscroll-hint", "How long to wait before auto-scroll resumes") }}
          </span>
        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">
              {{ t("subtitle-scroll-position-label", "Subtitle Scroll Position") }}
            </span>
            <span class="settings-field__value">{{ subtitleScrollPosition }}%</span>
          </div>
          <input type="range" min="0" max="100" step="1" class="slider" v-model.number="subtitleScrollPosition" />
          <small class="settings-field__hint">
            {{
              t(
                "subtitle-scroll-position-hint",
                "Where active subtitles sit in the panel (0% top, 50% middle, 100% bottom)"
              )
            }}
          </small>
        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">
              {{ t("subtitle-line-spacing-label", "Subtitle Line Spacing") }}
            </span>
            <span class="settings-field__value">{{ subtitleLineSpacing }}px</span>
          </div>
          <input type="range" min="0" max="60" step="1" class="slider" v-model.number="subtitleLineSpacing" />
          <small class="settings-field__hint">
            {{ t("subtitle-line-spacing-hint", "Adjust vertical spacing between lines") }}
          </small>
        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("subtitle-time-gap-label", "Timestamp to Text Gap") }}</span>
            <span class="settings-field__value">{{ subtitleTimeTextGap }}px</span>
          </div>
          <input type="range" min="0" max="60" step="1" class="slider" v-model.number="subtitleTimeTextGap" />
          <small class="settings-field__hint">
            {{ t("subtitle-time-gap-hint", "Distance between timestamp and subtitle text") }}
          </small>
        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">
              {{ t("subtitle-primary-secondary-gap-label", "Primary to Secondary Subtitle Gap") }}
            </span>
            <span class="settings-field__value">{{ subtitlePrimarySecondaryGap }}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            class="slider"
            v-model.number="subtitlePrimarySecondaryGap"
          />
          <small class="settings-field__hint">
            {{ t("subtitle-primary-secondary-gap-hint", "Vertical distance between primary and secondary subtitle") }}
          </small>
        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("subtitle-line-height-label", "Line Height") }}</span>
            <span class="settings-field__value">{{ subtitleLineHeight }}</span>
          </div>
          <input type="range" min="1" max="3" step="0.05" class="slider" v-model.number="subtitleLineHeight" />
          <small class="settings-field__hint">
            {{ t("subtitle-line-height-hint", "Control line-height for readability") }}
          </small>
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("subtitle-primary-color-label", "Primary Subtitle Text Color") }}</span>
          <input type="color" v-model="subtitlePrimaryColor" />
          <small class="settings-field__hint">
            {{ t("subtitle-primary-color-hint", "Default text color for primary subtitles") }}
          </small>
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("subtitle-secondary-color-label", "Secondary Subtitle Text Color") }}</span>
          <input type="color" v-model="subtitleSecondaryColor" />
          <small class="settings-field__hint">
            {{ t("subtitle-secondary-color-hint", "Default text color for secondary subtitles") }}
          </small>
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("subtitle-active-primary-color-label", "Active Primary Subtitle Color") }}</span>
          <input type="color" v-model="subtitleActivePrimaryColor" />
          <small class="settings-field__hint">
            {{ t("subtitle-active-primary-color-hint", "Text color while active") }}
          </small>
        </label>
        <label class="settings-field">
          <span class="settings-field__label">
            {{ t("subtitle-active-secondary-color-label", "Active Secondary Subtitle Color") }}
          </span>
          <input type="color" v-model="subtitleActiveSecondaryColor" />
          <small class="settings-field__hint">
            {{ t("subtitle-active-secondary-color-hint", "Text color for active secondary subtitles") }}
          </small>
        </label>

        <div class="priority-editor">
          <div class="priority-editor__header">
            <span class="settings-field__label">{{ t("primary-priority-label", "Primary Subtitle Priority") }}</span>
            <span class="priority-editor__hint">
              {{ t("primary-priority-hint", "Match language/tag keywords; reorder to reprioritize") }}
            </span>
          </div>
          <div class="priority-editor__list">
            <template v-if="primaryPriority.length">
              <span
                v-for="(item, index) in primaryPriority"
                :key="`${item}-${index}`"
                class="priority-editor__item"
              >
                <span>{{ item }}</span>
                <button
                  type="button"
                  class="priority-editor__item-remove"
                  :aria-label="t('priority-remove', 'Remove priority')"
                  @click="removePriority('primary', item)"
                >
                  ✕
                </button>
                <div class="priority-editor__actions">
                  <button
                    class="text-button"
                    type="button"
                    :disabled="index === 0"
                    @click="movePriority('primary', index, 'up')"
                  >
                    ↑
                  </button>
                  <button
                    class="text-button"
                    type="button"
                    :disabled="index === primaryPriority.length - 1"
                    @click="movePriority('primary', index, 'down')"
                  >
                    ↓
                  </button>
                </div>
              </span>
            </template>
            <span v-else class="priority-editor__empty">
              {{ t("priority-empty", "No priorities yet") }}
            </span>
          </div>
          <div class="priority-editor__controls">
            <input
              type="text"
              v-model="primaryPriorityInput"
              :placeholder="t('primary-priority-placeholder', 'e.g.: en')"
              @keyup.enter="addPriority('primary')"
            />
            <button type="button" class="text-button" @click="addPriority('primary')">
              {{ t("button-add", "Add") }}
            </button>
          </div>
        </div>

        <div class="priority-editor">
          <div class="priority-editor__header">
            <span class="settings-field__label">
              {{ t("secondary-priority-label", "Secondary Subtitle Priority") }}
            </span>
            <span class="priority-editor__hint">
              {{ t("secondary-priority-hint", "Usually the keywords for your native language") }}
            </span>
          </div>
          <div class="priority-editor__list">
            <template v-if="secondaryPriority.length">
              <span
                v-for="(item, index) in secondaryPriority"
                :key="`${item}-${index}`"
                class="priority-editor__item"
              >
                <span>{{ item }}</span>
                <button
                  type="button"
                  class="priority-editor__item-remove"
                  :aria-label="t('priority-remove', 'Remove priority')"
                  @click="removePriority('secondary', item)"
                >
                  ✕
                </button>
                <div class="priority-editor__actions">
                  <button
                    class="text-button"
                    type="button"
                    :disabled="index === 0"
                    @click="movePriority('secondary', index, 'up')"
                  >
                    ↑
                  </button>
                  <button
                    class="text-button"
                    type="button"
                    :disabled="index === secondaryPriority.length - 1"
                    @click="movePriority('secondary', index, 'down')"
                  >
                    ↓
                  </button>
                </div>
              </span>
            </template>
            <span v-else class="priority-editor__empty">
              {{ t("priority-empty", "No priorities yet") }}
            </span>
          </div>
          <div class="priority-editor__controls">
            <input
              type="text"
              v-model="secondaryPriorityInput"
              :placeholder="t('secondary-priority-placeholder', 'e.g.: zh, zh-Hans')"
              @keyup.enter="addPriority('secondary')"
            />
            <button type="button" class="text-button" @click="addPriority('secondary')">
              {{ t("button-add", "Add") }}
            </button>
          </div>
        </div>

        <label class="settings-field">
          <span class="settings-field__label">{{ t("yt-dlp-args-label", "yt-dlp Arguments") }}</span>
          <textarea rows="3" spellcheck="false" v-model="ytDlpArgs"></textarea>
          <small class="settings-field__hint">
            {{ t("yt-dlp-args-hint", "Leave blank to use default arguments") }}
          </small>
        </label>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const profiles = computed(() => store.settings?.profiles ?? []);
const editingProfile = computed(() => store.editingProfile);
const editingProfileId = computed(() => store.editingProfile?.id ?? null);
const defaultProfileId = computed(() => store.settings?.defaultProfileId ?? null);
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

const subtitleFontFamily = computed({
  get: () => store.editingProfileSettings.subtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("subtitleFontFamily", value)
});

const subtitleFontSize = computed({
  get: () => store.editingProfileSettings.subtitleFontSize,
  set: (value: number) => store.updateProfileSetting("subtitleFontSize", value)
});

const subtitleAutoScrollTimeout = computed({
  get: () => store.editingProfileSettings.subtitleAutoScrollTimeout,
  set: (value: number) => store.updateProfileSetting("subtitleAutoScrollTimeout", value)
});

const subtitleScrollPosition = computed({
  get: () => store.editingProfileSettings.subtitleScrollPosition,
  set: (value: number) => store.updateProfileSetting("subtitleScrollPosition", value)
});

const subtitleLineSpacing = computed({
  get: () => store.editingProfileSettings.subtitleLineSpacing,
  set: (value: number) => store.updateProfileSetting("subtitleLineSpacing", value)
});

const subtitleTimeTextGap = computed({
  get: () => store.editingProfileSettings.subtitleTimeTextGap,
  set: (value: number) => store.updateProfileSetting("subtitleTimeTextGap", value)
});

const subtitlePrimarySecondaryGap = computed({
  get: () => store.editingProfileSettings.subtitlePrimarySecondaryGap,
  set: (value: number) => store.updateProfileSetting("subtitlePrimarySecondaryGap", value)
});

const subtitleLineHeight = computed({
  get: () => store.editingProfileSettings.subtitleLineHeight,
  set: (value: number) => store.updateProfileSetting("subtitleLineHeight", value)
});

const subtitlePrimaryColor = computed({
  get: () => store.editingProfileSettings.subtitlePrimaryColor,
  set: (value: string) => store.updateProfileSetting("subtitlePrimaryColor", value)
});

const subtitleSecondaryColor = computed({
  get: () => store.editingProfileSettings.subtitleSecondaryColor,
  set: (value: string) => store.updateProfileSetting("subtitleSecondaryColor", value)
});

const subtitleActivePrimaryColor = computed({
  get: () => store.editingProfileSettings.subtitleActivePrimaryColor,
  set: (value: string) => store.updateProfileSetting("subtitleActivePrimaryColor", value)
});

const subtitleActiveSecondaryColor = computed({
  get: () => store.editingProfileSettings.subtitleActiveSecondaryColor,
  set: (value: string) => store.updateProfileSetting("subtitleActiveSecondaryColor", value)
});

const ytDlpArgs = computed({
  get: () => store.editingProfileSettings.ytDlpArgs,
  set: (value: string) => store.updateProfileSetting("ytDlpArgs", value)
});

const primaryPriority = computed(() => store.editingProfileSettings.primarySubtitlePriority ?? []);
const secondaryPriority = computed(() => store.editingProfileSettings.secondarySubtitlePriority ?? []);
const primaryPriorityInput = ref("");
const secondaryPriorityInput = ref("");

function deleteEditingProfile() {
  if (editingProfileId.value) {
    store.deleteProfile(editingProfileId.value);
  }
}

function setDefaultProfile() {
  if (editingProfileId.value) {
    store.setDefaultProfile(editingProfileId.value);
  }
}

function addPriority(role: "primary" | "secondary") {
  const input = role === "primary" ? primaryPriorityInput : secondaryPriorityInput;
  store.addPriority(role, input.value);
  input.value = "";
}

function removePriority(role: "primary" | "secondary", value: string) {
  store.removePriority(role, value);
}

function movePriority(role: "primary" | "secondary", index: number, direction: "up" | "down") {
  store.movePriority(role, index, direction);
}
</script>
