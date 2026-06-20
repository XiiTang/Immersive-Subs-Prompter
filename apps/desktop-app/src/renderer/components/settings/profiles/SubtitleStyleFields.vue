<template>
  <div class="subtitle-style-fields" data-testid="subtitle-style-compact-panel">
    <div class="subtitle-style-fields__typography">
      <div
        class="subtitle-style-fields__typography-row subtitle-style-fields__typography-row--primary"
        data-testid="primary-subtitle-typography-row"
      >
        <UiField
          id="primary-subtitle-font"
          class="subtitle-style-fields__field subtitle-style-fields__field--font"
          density="compact"
          :label="t('primary-subtitle-font-label')"
        >
          <UiSelect
            v-model="primarySubtitleFontFamily"
            data-testid="primary-subtitle-font-select"
            size="compact"
            :options="subtitleFontOptions"
          />
        </UiField>
        <UiField
          id="primary-subtitle-font-size"
          class="subtitle-style-fields__field subtitle-style-fields__field--slider"
          density="compact"
          :label="t('primary-subtitle-font-size-label')"
          :value="`${draft.primarySubtitleFontSize}px`"
        >
          <UiSlider
            v-model="draft.primarySubtitleFontSize"
            :min="3"
            :max="96"
            :step="1"
            :label="t('primary-subtitle-font-size-label')"
            @change="commitDraftProfileSetting('primarySubtitleFontSize')"
          />
        </UiField>
      </div>

      <div class="subtitle-style-fields__typography-row" data-testid="secondary-subtitle-typography-row">
        <UiField
          id="secondary-subtitle-font"
          class="subtitle-style-fields__field subtitle-style-fields__field--font"
          density="compact"
          :label="t('secondary-subtitle-font-label')"
        >
          <UiSelect
            v-model="secondarySubtitleFontFamily"
            data-testid="secondary-subtitle-font-select"
            size="compact"
            :options="subtitleFontOptions"
          />
        </UiField>
        <UiField
          id="secondary-subtitle-font-size"
          class="subtitle-style-fields__field subtitle-style-fields__field--slider"
          density="compact"
          :label="t('secondary-subtitle-font-size-label')"
          :value="`${draft.secondarySubtitleFontSize}px`"
        >
          <UiSlider
            v-model="draft.secondarySubtitleFontSize"
            :min="3"
            :max="96"
            :step="1"
            :label="t('secondary-subtitle-font-size-label')"
            @change="commitDraftProfileSetting('secondarySubtitleFontSize')"
          />
        </UiField>
      </div>
    </div>

    <div class="subtitle-style-fields__colors">
      <ColorSchemeGrid />
    </div>

    <div class="subtitle-style-fields__layout-grid" data-testid="subtitle-style-layout-grid">
      <UiField
        id="subtitle-scroll-position"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider"
        density="compact"
        :label="t('subtitle-scroll-position-label')"
        :value="`${draft.subtitleScrollPosition}%`"
      >
        <UiSlider
          v-model="draft.subtitleScrollPosition"
          :min="0"
          :max="100"
          :step="1"
          :label="t('subtitle-scroll-position-label')"
          @change="commitDraftProfileSetting('subtitleScrollPosition')"
        />
      </UiField>
      <UiField
        id="subtitle-primary-secondary-gap"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider"
        density="compact"
        :label="t('subtitle-primary-secondary-gap-label')"
        :value="`${draft.subtitlePrimarySecondaryGap}px`"
      >
        <UiSlider
          v-model="draft.subtitlePrimarySecondaryGap"
          :min="0"
          :max="60"
          :step="1"
          :label="t('subtitle-primary-secondary-gap-label')"
          @change="commitDraftProfileSetting('subtitlePrimarySecondaryGap')"
        />
      </UiField>
      <UiField
        id="subtitle-line-height"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider"
        density="compact"
        :label="t('subtitle-line-height-label')"
        :value="String(draft.subtitleLineHeight)"
      >
        <UiSlider
          v-model="draft.subtitleLineHeight"
          :min="1"
          :max="3"
          :step="0.05"
          :label="t('subtitle-line-height-label')"
          @change="commitDraftProfileSetting('subtitleLineHeight')"
        />
      </UiField>
      <UiField
        id="subtitle-block-gap"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider"
        density="compact"
        :label="t('subtitle-block-gap-label')"
        :value="`${draft.subtitleBlockGap}px`"
      >
        <UiSlider
          v-model="draft.subtitleBlockGap"
          :min="0"
          :max="60"
          :step="1"
          :label="t('subtitle-block-gap-label')"
          @change="commitDraftProfileSetting('subtitleBlockGap')"
        />
      </UiField>
    </div>

    <div class="subtitle-style-fields__behavior-row" data-testid="subtitle-style-behavior-row">
      <UiField
        id="subtitle-timestamp-font-size"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider subtitle-style-fields__field--timestamp"
        density="compact"
        :label="t('subtitle-timestamp-font-size-label')"
        :value="`${draft.subtitleTimestampFontSize}px`"
      >
        <UiSlider
          v-model="draft.subtitleTimestampFontSize"
          :min="6"
          :max="24"
          :step="1"
          :label="t('subtitle-timestamp-font-size-label')"
          @change="commitDraftProfileSetting('subtitleTimestampFontSize')"
        />
      </UiField>
      <div class="subtitle-style-fields__behavior-controls">
        <UiField
          id="subtitle-meta-auto-hide"
          class="subtitle-style-fields__field subtitle-style-fields__field--behavior"
          density="compact"
          :label="t('subtitle-meta-auto-hide-label')"
          inline
        >
          <UiSwitch
            v-model="subtitleAutoHideMetaRow"
            input-test-id="subtitle-meta-auto-hide-toggle"
            :label="subtitleAutoHideMetaRow ? t('toggle-on') : t('toggle-off')"
            :show-label="false"
          />
        </UiField>
        <UiField
          id="subtitle-autoscroll"
          class="subtitle-style-fields__field subtitle-style-fields__field--behavior subtitle-style-fields__field--restore"
          density="compact"
          :label="t('subtitle-autoscroll-label')"
          inline
        >
          <UiInput
            :model-value="subtitleAutoScrollTimeoutDraft"
            class="subtitle-style-fields__autoscroll-input"
            size="compact"
            type="number"
            min="1"
            max="60"
            step="1"
            @update:model-value="updateSubtitleAutoScrollTimeoutDraft(String($event))"
          />
        </UiField>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { ProfileSettings } from "../../../../main/types";
import { SUBTITLE_FONT_OPTIONS } from "../../../../common/subtitleFonts.js";
import { DEFAULT_PROFILE_TEMPLATE, useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { UiField, UiInput, UiSelect, UiSlider, UiSwitch } from "../../ui";
import ColorSchemeGrid from "./ColorSchemeGrid.vue";
import { parseBoundedNumberDraft } from "../numericDraft";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const subtitleFontOptions = SUBTITLE_FONT_OPTIONS.map((option) => ({
  ...option,
  fontFamilyPreview: option.value
}));

type DraftProfileSettingKey =
  | "primarySubtitleFontSize"
  | "secondarySubtitleFontSize"
  | "subtitleTimestampFontSize"
  | "subtitleScrollPosition"
  | "subtitlePrimarySecondaryGap"
  | "subtitleLineHeight"
  | "subtitleBlockGap";

const draft = reactive<Record<DraftProfileSettingKey, number>>({
  primarySubtitleFontSize: 0,
  secondarySubtitleFontSize: 0,
  subtitleTimestampFontSize: 0,
  subtitleScrollPosition: 0,
  subtitlePrimarySecondaryGap: 0,
  subtitleLineHeight: 0,
  subtitleBlockGap: 0
});
const subtitleAutoScrollTimeoutDraft = ref("");

function syncDraftFromStore() {
  const settings = store.editingProfileSettings;
  draft.primarySubtitleFontSize = settings.primarySubtitleFontSize;
  draft.secondarySubtitleFontSize = settings.secondarySubtitleFontSize;
  draft.subtitleTimestampFontSize =
    settings.subtitleTimestampFontSize ?? DEFAULT_PROFILE_TEMPLATE.subtitleTimestampFontSize;
  draft.subtitleScrollPosition = settings.subtitleScrollPosition;
  draft.subtitlePrimarySecondaryGap = settings.subtitlePrimarySecondaryGap;
  draft.subtitleLineHeight = settings.subtitleLineHeight;
  draft.subtitleBlockGap = settings.subtitleBlockGap;
}

function commitDraftProfileSetting<Key extends DraftProfileSettingKey>(key: Key) {
  store.updateProfileSetting(key, draft[key] as ProfileSettings[Key]);
}

function updateSubtitleAutoScrollTimeoutDraft(value: string) {
  subtitleAutoScrollTimeoutDraft.value = value;
  const timeout = parseBoundedNumberDraft(value, 1, 60);
  if (timeout !== null) {
    store.updateProfileSetting("subtitleAutoScrollTimeout", timeout);
  }
}

watch(
  () => [store.editingProfileId, store.editingProfileSettings],
  syncDraftFromStore,
  { immediate: true, deep: true }
);

const primarySubtitleFontFamily = computed({
  get: () => store.editingProfileSettings.primarySubtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("primarySubtitleFontFamily", value)
});

const secondarySubtitleFontFamily = computed({
  get: () => store.editingProfileSettings.secondarySubtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("secondarySubtitleFontFamily", value)
});

const subtitleAutoHideMetaRow = computed({
  get: () => store.editingProfileSettings.subtitleAutoHideMetaRow,
  set: (value: boolean) => store.updateProfileSetting("subtitleAutoHideMetaRow", value)
});

watch(
  () => store.editingProfileSettings.subtitleAutoScrollTimeout,
  (timeout) => {
    subtitleAutoScrollTimeoutDraft.value = String(timeout);
  },
  { immediate: true }
);
</script>
