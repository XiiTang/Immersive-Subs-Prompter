<template>
  <UiSection :title="t('plugin-section-title', 'Plugin Management')">
    <div v-if="catalog.length" class="ui-list plugin-list">
      <UiListItem v-for="plugin in catalog" :key="plugin.id" as="article">
        <div class="ui-list-item__main">
          <div class="ui-list-item__title-row">
            <span class="ui-list-item__title">{{ localizePluginName(plugin, t) }}</span>
            <span class="ui-list-item__meta">v{{ plugin.version }}</span>
            <UiBadge :tone="statusTone(plugin.status)">{{ statusLabel(plugin.status) }}</UiBadge>
          </div>
          <p class="ui-list-item__description">{{ localizePluginDescription(plugin, t) }}</p>
          <p v-if="plugin.error" class="ui-field__error">{{ plugin.error }}</p>
        </div>

        <UiButton :variant="plugin.enabled ? 'secondary' : 'primary'" @click="plugin.enabled ? store.disablePlugin(plugin.id) : store.enablePlugin(plugin.id)">
          {{ plugin.enabled ? t("plugin-disable", "Disable") : t("plugin-enable", "Enable") }}
        </UiButton>
      </UiListItem>
    </div>
    <UiEmptyState v-else :message="t('plugin-empty', 'No plugins available.')" />
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { localizePluginDescription, localizePluginName } from "../../plugins/pluginLocalization";
import { useDesktopStore } from "../../stores/desktop";
import { UiBadge, UiButton, UiEmptyState, UiListItem, UiSection } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const catalog = computed(() => store.pluginCatalog);

function statusLabel(status: string): string {
  switch (status) {
    case "disabled":
      return t("plugin-status-disabled", "Disabled");
    case "enabled":
      return t("plugin-status-enabled", "Enabled");
    case "broken":
      return t("plugin-status-broken", "Error");
    default:
      return status;
  }
}

function statusTone(status: string): "success" | "neutral" | "danger" {
  if (status === "enabled") return "success";
  if (status === "broken") return "danger";
  return "neutral";
}
</script>
