<template>
  <UiSection :title="t('features-section-title')">
    <div class="features-list">
      <UiListItem as="article" class="feature-row">
        <div class="feature-row__header">
          <div class="feature-row__main">
            <div class="ui-list-item__title">{{ t("feature-word-lookup-title") }}</div>
            <p class="ui-list-item__description">{{ t("feature-word-lookup-description") }}</p>
          </div>
          <UiSwitch
            :model-value="features.wordLookup.enabled"
            :label="features.wordLookup.enabled ? t('feature-enabled') : t('feature-disabled')"
            input-test-id="feature-enabled-wordLookup"
            @update:model-value="store.setFeatureEnabled('wordLookup', $event)"
          />
        </div>
        <WordLookupFeatureSettings />
      </UiListItem>

      <UiListItem as="article" class="feature-row">
        <div class="feature-row__header">
          <div class="feature-row__main">
            <div class="ui-list-item__title">{{ t("feature-transcription-title") }}</div>
            <p class="ui-list-item__description">{{ t("feature-transcription-description") }}</p>
          </div>
          <UiSwitch
            :model-value="features.transcription.enabled"
            :label="features.transcription.enabled ? t('feature-enabled') : t('feature-disabled')"
            input-test-id="feature-enabled-transcription"
            @update:model-value="store.setFeatureEnabled('transcription', $event)"
          />
        </div>
        <TranscriptionFeatureSettings />
      </UiListItem>

      <UiListItem as="article" class="feature-row">
        <div class="feature-row__header">
          <div class="feature-row__main">
            <div class="ui-list-item__title">{{ t("feature-jellyfin-emby-title") }}</div>
            <p class="ui-list-item__description">{{ t("feature-jellyfin-emby-description") }}</p>
          </div>
          <UiSwitch
            :model-value="features.jellyfinEmby.enabled"
            :label="features.jellyfinEmby.enabled ? t('feature-enabled') : t('feature-disabled')"
            input-test-id="feature-enabled-jellyfinEmby"
            @update:model-value="store.setFeatureEnabled('jellyfinEmby', $event)"
          />
        </div>
        <JellyfinEmbyFeatureSettings />
      </UiListItem>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cloneFeatureSettings } from "../../../common/featureDefaults";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiListItem, UiSection, UiSwitch } from "../ui";
import JellyfinEmbyFeatureSettings from "./JellyfinEmbyFeatureSettings.vue";
import TranscriptionFeatureSettings from "./TranscriptionFeatureSettings.vue";
import WordLookupFeatureSettings from "./WordLookupFeatureSettings.vue";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const features = computed(() => store.settings?.features ?? cloneFeatureSettings());
</script>

<style scoped>
.features-list {
  display: grid;
  gap: 12px;
}

.feature-row {
  display: grid;
  gap: 14px;
}

.feature-row__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.feature-row__main {
  min-width: 0;
}

@media (max-width: 760px) {
  .feature-row__header {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
