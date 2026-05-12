<template>
  <section class="settings-section">
    <header class="settings-section__intro settings-section__intro--with-toggle">
      <div>
        <h3 class="settings-section__title">{{ t("section-cache", "Subtitle Cache") }}</h3>
      </div>
      <label class="toggle toggle--sm settings-section__toggle">
        <input type="checkbox" v-model="cacheEnabled" />
        <span class="toggle__text">{{ cacheEnabled ? t("toggle-on", "On") : t("toggle-off", "Off") }}</span>
      </label>
    </header>
    
    <div v-if="cacheEnabled" class="settings-surface settings-panel" data-testid="cache-settings-surface">
      <div class="settings-group settings-group--plain">
        <div class="cache-field-row">
          <div class="settings-field cache-field--grow">
            <div class="settings-field-header">
              <span class="settings-field__label">{{ t("cache-path-label", "Cache Path") }}</span>
              <button
                type="button"
                class="icon-button"
                @click="openCacheFolder"
                :title="t('button-open-cache', 'Open Cache Folder')"
                :aria-label="t('button-open-cache', 'Open Cache Folder')"
              >
                <IconFolder size="md" />
              </button>
            </div>
            <input
              type="text"
              v-model="cachePath"
              class="settings-input"
            />
          </div>
          <div class="settings-field cache-field--fixed">
            <span class="settings-field__label">{{ t("cache-retention-label", "Retention (days)") }}</span>
            <input
              type="number"
              min="1"
              max="9999"
              step="1"
              v-model.number="cacheRetentionDays"
              class="settings-input cache-field--narrow"
            />
          </div>
        </div>
      </div>

      <div class="settings-group settings-group--plain">
        <div class="cache-status-row">
          <div class="cache-status-item">
            <span class="settings-field__label">{{ statLabel("cache-stats-entries", "Total entries") }}</span>
            <span class="settings-badge">{{ cacheStatsDisplay.entries }}</span>
          </div>
          <div class="cache-status-item">
            <span class="settings-field__label">{{ statLabel("cache-stats-size", "Total size") }}</span>
            <span class="settings-badge">{{ cacheStatsDisplay.size }}</span>
          </div>
          <div class="cache-status-item">
            <div class="cache-inline-row">
              <span class="settings-field__label">{{ statLabel("cache-stats-oldest", "Oldest entry") }}</span>
              <button
                type="button"
                class="icon-button icon-button--compact"
                data-testid="cache-stats-refresh"
                :disabled="cacheBusy"
                @click="refreshCacheStats"
                :title="t('button-refresh-stats', 'Refresh Stats')"
                :aria-label="t('button-refresh-stats', 'Refresh Stats')"
              >
                <IconRefresh size="sm" :class="{ 'icon--spinning': cacheBusy }" />
              </button>
            </div>
            <span class="settings-badge">{{ cacheStatsDisplay.oldest }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { IconFolder, IconRefresh } from "../icons";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const cacheBusy = ref(false);

const cacheEnabled = computed({
  get: () => store.settings?.cache.enabled ?? true,
  set: (value: boolean) => store.updateCacheSetting("enabled", value)
});

const cachePath = computed({
  get: () => store.settings?.cache.path ?? "",
  set: (value: string) => store.updateCacheSetting("path", value)
});

const cacheRetentionDays = computed({
  get: () => store.settings?.cache.retentionDays ?? 30,
  set: (value: number) => store.updateCacheSetting("retentionDays", value)
});

const cacheStatsDisplay = computed(() => {
  const stats = store.cacheStats;
  if (!stats) {
    return { entries: "-", size: "-", oldest: "-" };
  }
  const sizeMb = (stats.totalSize / (1024 * 1024)).toFixed(2);
  const oldestDate = stats.oldestEntry ? new Date(stats.oldestEntry).toLocaleDateString() : "-";
  return {
    entries: stats.totalEntries,
    size: `${sizeMb} MB`,
    oldest: oldestDate
  };
});

async function refreshCacheStats() {
  cacheBusy.value = true;
  try {
    await store.refreshCacheStats();
  } finally {
    cacheBusy.value = false;
  }
}


function openCacheFolder() {
  store.openCacheFolder();
}

function statLabel(key: string, fallback: string): string {
  return t(key, fallback).replace(/[：:]\s*$/, "");
}
</script>
