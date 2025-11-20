<template>
  <section class="settings-section">
    <h3 class="settings-section__title">{{ t("section-cache", "Subtitle Cache") }}</h3>
    <div class="settings-field settings-field--inline">
      <span class="settings-field__label">{{ t("enable-cache-label", "Enable Cache") }}</span>
      <label class="toggle">
        <input type="checkbox" v-model="cacheEnabled" />
        <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
      </label>
    </div>
    <label class="settings-field">
      <span class="settings-field__label">{{ t("cache-path-label", "Cache Path") }}</span>
      <input type="text" v-model="cachePath" />
      <small class="settings-field__hint">{{ t("cache-path-hint", "Leave blank to use default location") }}</small>
    </label>
    <label class="settings-field">
      <span class="settings-field__label">{{ t("cache-retention-label", "Retention (days)") }}</span>
      <input type="number" min="1" max="365" step="1" v-model.number="cacheRetentionDays" />
      <small class="settings-field__hint">
        {{ t("cache-retention-hint", "How long cached subtitles are kept (1-365)") }}
      </small>
    </label>
    <div class="cache-stats">
      <div class="cache-stats__item">
        <span class="cache-stats__label">{{ t("cache-stats-entries", "Total entries:") }}</span>
        <span class="cache-stats__value">{{ cacheStatsDisplay.entries }}</span>
      </div>
      <div class="cache-stats__item">
        <span class="cache-stats__label">{{ t("cache-stats-size", "Total size:") }}</span>
        <span class="cache-stats__value">{{ cacheStatsDisplay.size }}</span>
      </div>
      <div class="cache-stats__item">
        <span class="cache-stats__label">{{ t("cache-stats-oldest", "Oldest entry:") }}</span>
        <span class="cache-stats__value">{{ cacheStatsDisplay.oldest }}</span>
      </div>
    </div>
    <div class="cache-actions">
      <button type="button" class="text-button" :disabled="cacheBusy" @click="openCacheFolder">
        {{ t("button-open-cache", "Open Folder") }}
      </button>
      <button type="button" class="text-button" :disabled="cacheBusy" @click="refreshCacheStats">
        {{ t("button-refresh-stats", "Refresh Stats") }}
      </button>
      <button type="button" class="text-button" :disabled="cacheBusy" @click="cleanupCache">
        {{ t("button-cleanup", "Cleanup expired") }}
      </button>
      <button type="button" class="text-button" :disabled="cacheBusy" @click="clearCache">
        {{ t("button-clear-cache", "Clear all") }}
      </button>
    </div>
    <div v-if="cacheMessage" class="settings-field__hint">{{ cacheMessage }}</div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const cacheBusy = ref(false);
const cacheMessage = ref("");

const cacheEnabled = computed({
  get: () => store.settings?.cache.enabled ?? true,
  set: (value: boolean) => store.updateCacheSetting("enabled", value)
});

const cachePath = computed({
  get: () => store.settings?.cache.customPath ?? "",
  set: (value: string) => store.updateCacheSetting("customPath", value)
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

async function cleanupCache() {
  cacheBusy.value = true;
  cacheMessage.value = "Cleaning up...";
  try {
    const result = await store.cleanupCache();
    cacheMessage.value = t("cache-cleanup-success", "Cleanup complete. Removed {count} entries.", {
      count: result.removedCount
    });
  } catch (error) {
    cacheMessage.value = t("cache-cleanup-error", "Cleanup failed.");
  } finally {
    cacheBusy.value = false;
  }
}

async function clearCache() {
  if (!confirm(t("cache-clear-confirm", "Are you sure you want to clear all cached subtitles?"))) {
    return;
  }
  cacheBusy.value = true;
  cacheMessage.value = "Clearing cache...";
  try {
    await store.clearCache();
    cacheMessage.value = t("cache-clear-success", "Cache cleared.");
  } catch (error) {
    cacheMessage.value = t("cache-clear-error", "Failed to clear cache.");
  } finally {
    cacheBusy.value = false;
  }
}

function openCacheFolder() {
  store.openCacheFolder();
}
</script>
