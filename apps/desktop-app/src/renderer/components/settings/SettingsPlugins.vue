<template>
  <section class="settings-section">
    <header class="settings-section__intro">
      <div>
        <h3 class="settings-section__title">{{ t("plugin-section-title", "Plugin Management") }}</h3>
      </div>
    </header>
    <div class="plugin-list settings-surface" v-if="catalog.length">
      <div v-for="plugin in catalog" :key="plugin.id" class="plugin-card">
        <div class="plugin-card__info">
          <div class="plugin-card__header">
            <span class="plugin-card__name">{{ plugin.displayName }}</span>
            <span class="plugin-card__version">v{{ plugin.version }}</span>
            <span
              class="plugin-card__badge"
              :class="{
                'plugin-card__badge--enabled': plugin.status === 'enabled',
                'plugin-card__badge--disabled': plugin.status === 'disabled',
                'plugin-card__badge--error': plugin.status === 'broken'
              }"
            >
              {{ statusLabel(plugin.status) }}
            </span>
          </div>
          <p class="plugin-card__description">{{ plugin.description }}</p>
          <p v-if="plugin.error" class="plugin-card__error">{{ plugin.error }}</p>
        </div>
        <div class="plugin-card__actions">
          <template v-if="plugin.enabled">
            <button type="button" class="btn-secondary" @click="store.disablePlugin(plugin.id)">
              {{ t("plugin-disable", "Disable") }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="btn-primary" @click="store.enablePlugin(plugin.id)">
              {{ t("plugin-enable", "Enable") }}
            </button>
          </template>
        </div>
      </div>
    </div>
    <p v-else class="plugin-empty">{{ t("plugin-empty", "No plugins available.") }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";

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
</script>
