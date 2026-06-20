<template>
  <UiSection :title="t('features-section-title')">
    <div class="features-list" role="list" :aria-label="t('features-section-title')">
      <UiListItem
        v-for="feature in featureDefinitions"
        :key="feature.id"
        as="article"
        class="feature-enable-row"
        role="listitem"
        :data-testid="`feature-row-${feature.id}`"
      >
        <div class="feature-enable-row__main">
          <div class="ui-list-item__title">{{ feature.title }}</div>
          <p class="ui-list-item__description">{{ feature.description }}</p>
        </div>
        <UiSwitch
          class="feature-enable-row__switch"
          :model-value="isFeatureEnabled(feature.id)"
          :label="feature.title"
          :show-label="false"
          :input-test-id="`feature-enabled-${feature.id}`"
          @update:model-value="setFeatureEnabled(feature.id, $event)"
        />
      </UiListItem>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cloneFeatureSettings, type FeatureId } from "../../../common/featureDefaults";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiListItem, UiSection, UiSwitch } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const features = computed(() => store.settings?.features ?? cloneFeatureSettings());

const featureDefinitions = computed(() => [
  {
    id: "wordLookup",
    title: t("feature-word-lookup-title"),
    description: t("feature-word-lookup-description")
  },
  {
    id: "transcription",
    title: t("feature-transcription-title"),
    description: t("feature-transcription-description")
  },
  {
    id: "jellyfinEmby",
    title: t("feature-jellyfin-emby-title"),
    description: t("feature-jellyfin-emby-description")
  }
] satisfies Array<{ id: FeatureId; title: string; description: string }>);

function isFeatureEnabled(featureId: FeatureId) {
  return features.value[featureId].enabled;
}

function setFeatureEnabled(featureId: FeatureId, enabled: boolean) {
  void store.setFeatureEnabled(featureId, enabled);
}
</script>

<style scoped>
.features-list {
  display: grid;
  gap: 12px;
}

.feature-enable-row {
  align-items: center;
}

.feature-enable-row__main {
  min-width: 0;
}
</style>
