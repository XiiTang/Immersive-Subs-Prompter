<template>
  <section class="settings-section">
    <header class="settings-section__intro">
      <div>
        <h3 class="settings-section__title">{{ t("section-profiles", "Profiles") }}</h3>
      </div>
    </header>
    <div class="profile-settings settings-surface settings-surface--split">
      <div class="profile-settings__sidebar">
        <div class="profile-settings__actions">
          <span class="settings-field__label">{{ t("profile-list-label", "Profile List") }}</span>
          <div class="profile-settings__buttons">
            <button
              type="button"
              class="icon-button"
              :title="t('button-add', 'Add')"
              :aria-label="t('button-add', 'Add')"
              @click="store.addProfile()"
            >
              <IconAdd size="md" />
            </button>
            <button type="button" class="text-button" @click="store.duplicateProfile()">
              {{ t("button-duplicate", "Duplicate") }}
            </button>
            <button
              type="button"
              class="icon-button"
              :disabled="!canDeleteProfile"
              :title="t('button-delete', 'Delete')"
              :aria-label="t('button-delete', 'Delete')"
              @click="deleteEditingProfile"
            >
              <IconDelete size="md" />
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
              <span v-if="profile.id === activeProfileId" class="profile-list__badge">
                {{ t("active-badge", "Applied") }}
              </span>
              <span v-else-if="profile.id === defaultProfileId" class="profile-list__badge">
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
          <select v-model="subtitleFontFamily" data-testid="subtitle-font-select">
            <option v-for="fontOption in subtitleFontOptions" :key="fontOption.value" :value="fontOption.value">
              {{ fontOption.label }}
            </option>
          </select>
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("subtitle-font-size-label", "Subtitle Font Size") }}</span>
          <input type="number" min="10" max="48" step="1" v-model.number="subtitleFontSize" />
        </label>
        <div class="settings-field settings-field--inline">
          <span class="settings-field__label">
            {{ t("subtitle-meta-auto-hide-label", "Auto-hide Timestamps & Actions") }}
          </span>
          <label class="toggle">
            <input
              type="checkbox"
              v-model="subtitleAutoHideMetaRow"
              data-testid="subtitle-meta-auto-hide-toggle"
            />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>
        <label class="settings-field">
          <span class="settings-field__label">
            {{ t("subtitle-autoscroll-label", "Auto-scroll Restore Time (seconds)") }}
          </span>
          <input type="number" min="1" max="60" step="1" v-model.number="subtitleAutoScrollTimeout" />

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

        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("subtitle-line-height-label", "Line Height") }}</span>
            <span class="settings-field__value">{{ subtitleLineHeight }}</span>
          </div>
          <input type="range" min="1" max="3" step="0.05" class="slider" v-model.number="subtitleLineHeight" />

        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("subtitle-block-gap-label", "Block Gap") }}</span>
            <span class="settings-field__value">{{ subtitleBlockGap }}px</span>
          </div>
          <input type="range" min="0" max="60" step="1" class="slider" v-model.number="subtitleBlockGap" />
          <small class="settings-field__hint">
            {{ t("subtitle-block-gap-hint", "Gap between subtitle text blocks") }}
          </small>
        </label>
        <div class="settings-group">
          <div class="settings-group__title">{{ t("subtitle-colors-group", "Color Scheme") }}</div>
          <div class="settings-color-grid">
            <div class="color-swatch-item">
              <label class="color-swatch-preview">
                <input type="color" v-model="subtitlePrimaryColor" class="sr-only-input" />
                <div class="color-swatch-preview__fill" :style="{ backgroundColor: subtitlePrimaryColor }"></div>
              </label>
              <div class="color-swatch-info">
                <span class="color-swatch-label">{{ t("subtitle-primary-color-label", "Primary Text") }}</span>
                <input type="text" v-model="subtitlePrimaryColor" class="color-swatch-input" spellcheck="false" />
              </div>
            </div>

            <div class="color-swatch-item">
              <label class="color-swatch-preview">
                <input type="color" v-model="subtitleSecondaryColor" class="sr-only-input" />
                <div class="color-swatch-preview__fill" :style="{ backgroundColor: subtitleSecondaryColor }"></div>
              </label>
              <div class="color-swatch-info">
                <span class="color-swatch-label">{{ t("subtitle-secondary-color-label", "Secondary Text") }}</span>
                <input type="text" v-model="subtitleSecondaryColor" class="color-swatch-input" spellcheck="false" />
              </div>
            </div>

            <div class="color-swatch-item">
              <label class="color-swatch-preview">
                <input type="color" v-model="subtitleActivePrimaryColor" class="sr-only-input" />
                <div class="color-swatch-preview__fill" :style="{ backgroundColor: subtitleActivePrimaryColor }"></div>
              </label>
              <div class="color-swatch-info">
                <span class="color-swatch-label">{{ t("subtitle-active-primary-color-label", "Active Primary") }}</span>
                <input type="text" v-model="subtitleActivePrimaryColor" class="color-swatch-input" spellcheck="false" />
              </div>
            </div>

            <div class="color-swatch-item">
              <label class="color-swatch-preview">
                <input type="color" v-model="subtitleActiveSecondaryColor" class="sr-only-input" />
                <div class="color-swatch-preview__fill" :style="{ backgroundColor: subtitleActiveSecondaryColor }"></div>
              </label>
              <div class="color-swatch-info">
                <span class="color-swatch-label">{{ t("subtitle-active-secondary-color-label", "Active Secondary") }}</span>
                <input type="text" v-model="subtitleActiveSecondaryColor" class="color-swatch-input" spellcheck="false" />
              </div>
            </div>
          </div>
        </div>

        <div class="priority-editor">
          <div class="priority-editor__header">
            <div class="priority-editor__label-row">
              <span class="settings-field__label">{{ t("primary-priority-label", "Primary Subtitle Priority") }}</span>
              <a
                class="priority-editor__link"
                :href="regexDocUrl"
                @click.prevent="openRegexDoc"
              >
                {{ t("priority-regex-examples", "查看正则示例") }}
              </a>
            </div>
            <span class="priority-editor__hint">
              {{
                t("primary-priority-hint", "Use regular expressions to match subtitle filenames; drag to reprioritize")
              }}
            </span>
          </div>
          <div class="priority-editor__list" @dragover.prevent @drop.prevent="onPriorityListDrop('primary')">
            <template v-if="primaryPriority.length">
              <span
                v-for="(item, index) in primaryPriority"
                :key="item"
                class="priority-editor__item"
                :class="{ 'priority-editor__item--dragover': isPriorityDragOver('primary', index) }"
                draggable="true"
                @dragstart="onPriorityDragStart('primary', index, $event)"
                @dragenter.prevent="onPriorityDragEnter('primary', index)"
                @dragover.prevent
                @drop.prevent.stop="onPriorityDrop('primary', index)"
                @dragleave="onPriorityDragLeave('primary', index)"
                @dragend="onPriorityDragEnd"
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
              :placeholder="t('primary-priority-placeholder', 'e.g.: en or zh-Hans')"
              @keyup.enter="addPriority('primary')"
            />
            <button
              type="button"
              class="icon-button"
              :title="t('button-add', 'Add')"
              :aria-label="t('button-add', 'Add')"
              @click="addPriority('primary')"
            >
              <IconAdd size="md" />
            </button>
          </div>
          <div v-if="primaryPriorityError" class="settings-field__error">
            {{ primaryPriorityError }}
          </div>
        </div>

        <div class="priority-editor">
          <div class="priority-editor__header">
            <div class="priority-editor__label-row">
              <span class="settings-field__label">
                {{ t("secondary-priority-label", "Secondary Subtitle Priority") }}
              </span>
            </div>
            <span class="priority-editor__hint">
              {{ t("secondary-priority-hint", "Use regular expressions to match subtitle filenames; drag to reprioritize") }}
            </span>
          </div>
          <div class="priority-editor__list" @dragover.prevent @drop.prevent="onPriorityListDrop('secondary')">
            <template v-if="secondaryPriority.length">
              <span
                v-for="(item, index) in secondaryPriority"
                :key="item"
                class="priority-editor__item"
                :class="{ 'priority-editor__item--dragover': isPriorityDragOver('secondary', index) }"
                draggable="true"
                @dragstart="onPriorityDragStart('secondary', index, $event)"
                @dragenter.prevent="onPriorityDragEnter('secondary', index)"
                @dragover.prevent
                @drop.prevent.stop="onPriorityDrop('secondary', index)"
                @dragleave="onPriorityDragLeave('secondary', index)"
                @dragend="onPriorityDragEnd"
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
              :placeholder="t('secondary-priority-placeholder', 'e.g.: en or zh-Hans')"
              @keyup.enter="addPriority('secondary')"
            />
            <button
              type="button"
              class="icon-button"
              :title="t('button-add', 'Add')"
              :aria-label="t('button-add', 'Add')"
              @click="addPriority('secondary')"
            >
              <IconAdd size="md" />
            </button>
          </div>
          <div v-if="secondaryPriorityError" class="settings-field__error">
            {{ secondaryPriorityError }}
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
import { SUBTITLE_FONT_OPTIONS } from "../../../common/subtitleFonts.js";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { IconAdd, IconDelete } from "../icons";
import { isValidRegex } from "../../../common/regex.js";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const profiles = computed(() => store.settings?.profiles ?? []);
const editingProfile = computed(() => store.editingProfile);
const editingProfileId = computed(() => store.editingProfile?.id ?? null);
const activeProfileId = computed(() => store.activeProfileId);
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
const subtitleFontOptions = SUBTITLE_FONT_OPTIONS;

const subtitleFontSize = computed({
  get: () => store.editingProfileSettings.subtitleFontSize,
  set: (value: number) => store.updateProfileSetting("subtitleFontSize", value)
});

const subtitleAutoHideMetaRow = computed({
  get: () => store.editingProfileSettings.subtitleAutoHideMetaRow,
  set: (value: boolean) => store.updateProfileSetting("subtitleAutoHideMetaRow", value)
});

const subtitleAutoScrollTimeout = computed({
  get: () => store.editingProfileSettings.subtitleAutoScrollTimeout,
  set: (value: number) => store.updateProfileSetting("subtitleAutoScrollTimeout", value)
});

const subtitleScrollPosition = computed({
  get: () => store.editingProfileSettings.subtitleScrollPosition,
  set: (value: number) => store.updateProfileSetting("subtitleScrollPosition", value)
});

const subtitlePrimarySecondaryGap = computed({
  get: () => store.editingProfileSettings.subtitlePrimarySecondaryGap,
  set: (value: number) => store.updateProfileSetting("subtitlePrimarySecondaryGap", value)
});

const subtitleLineHeight = computed({
  get: () => store.editingProfileSettings.subtitleLineHeight,
  set: (value: number) => store.updateProfileSetting("subtitleLineHeight", value)
});

const subtitleBlockGap = computed({
  get: () => store.editingProfileSettings.subtitleBlockGap,
  set: (value: number) => store.updateProfileSetting("subtitleBlockGap", value)
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
const primaryPriorityError = computed(() => getPriorityRegexError(primaryPriorityInput.value));
const secondaryPriorityError = computed(() => getPriorityRegexError(secondaryPriorityInput.value));
const regexDocUrl = "https://github.com/XiiTang/Immersive-Subs-Prompter/blob/main/docs/subtitle-priority-regex.md";

type PriorityRole = "primary" | "secondary";
type PriorityDragState = {
  role: PriorityRole | null;
  fromIndex: number | null;
  overIndex: number | null;
};

const priorityDragState = ref<PriorityDragState>({
  role: null,
  fromIndex: null,
  overIndex: null
});

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

function onPriorityDragStart(role: PriorityRole, index: number, event: DragEvent) {
  priorityDragState.value = { role, fromIndex: index, overIndex: index };
  event.dataTransfer?.setData("text/plain", `${role}:${index}`);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onPriorityDragEnter(role: PriorityRole, index: number) {
  if (priorityDragState.value.role !== role) {
    return;
  }
  priorityDragState.value.overIndex = index;
}

function onPriorityDragLeave(role: PriorityRole, index: number) {
  if (priorityDragState.value.role !== role) {
    return;
  }
  if (priorityDragState.value.overIndex === index) {
    priorityDragState.value.overIndex = null;
  }
}

function onPriorityDrop(role: PriorityRole, index: number) {
  const { role: draggingRole, fromIndex } = priorityDragState.value;
  if (draggingRole !== role || fromIndex === null) {
    resetPriorityDragState();
    return;
  }
  if (fromIndex !== index) {
    store.reorderPriority(role, fromIndex, index);
  }
  resetPriorityDragState();
}

function onPriorityListDrop(role: PriorityRole) {
  const { role: draggingRole, fromIndex, overIndex } = priorityDragState.value;
  if (draggingRole !== role || fromIndex === null) {
    resetPriorityDragState();
    return;
  }
  const listLength = role === "primary" ? primaryPriority.value.length : secondaryPriority.value.length;
  const targetIndex = Math.min(overIndex ?? listLength - 1, listLength - 1);
  if (targetIndex !== fromIndex) {
    store.reorderPriority(role, fromIndex, targetIndex);
  }
  resetPriorityDragState();
}

function onPriorityDragEnd() {
  resetPriorityDragState();
}

function resetPriorityDragState() {
  priorityDragState.value = {
    role: null,
    fromIndex: null,
    overIndex: null
  };
}

function isPriorityDragOver(role: PriorityRole, index: number) {
  const state = priorityDragState.value;
  return state.role === role && state.overIndex === index && state.fromIndex !== index;
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
