<template>
  <section class="settings-section">
    <h3 class="settings-section__title">{{ t("section-cache", "Subtitle Cache") }}</h3>
    
    <div class="fw-management-section">
      <div class="fw-card">
        <div class="fw-card__header">
          <div class="fw-card__title">{{ t("section-settings", "Settings") }}</div>
          <button
            type="button"
            class="icon-text-button"
            @click="openCacheFolder"
            :title="t('button-open-cache', 'Open Folder')"
          >
            <span class="icon">📂</span>
          </button>
        </div>
        
        <div class="fw-card__content">
          <div class="fw-field fw-field--inline">
            <span class="label">{{ t("enable-cache-label", "Enable Cache") }}</span>
            <label class="toggle toggle--sm">
              <input type="checkbox" v-model="cacheEnabled" />
              <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
            </label>
          </div>

          <div class="fw-folder-input">
            <span class="label">{{ t("cache-path-label", "Cache Path") }}</span>
            <input 
              type="text" 
              v-model="cachePath" 
              class="fw-input-sm" 
            />
          </div>

          <div class="fw-field">
            <span class="label">{{ t("cache-retention-label", "Retention (days)") }}</span>
            <input type="number" min="1" max="9999" step="1" v-model.number="cacheRetentionDays" class="fw-input-sm" />
          </div>
        </div>
      </div>

      <div class="fw-card">
        <div class="fw-card__header">
          <div class="fw-card__title">{{ t("section-stats", "Statistics") }}</div>
          <button 
            type="button" 
            class="icon-text-button" 
            :disabled="cacheBusy" 
            @click="refreshCacheStats"
            :title="t('button-refresh-stats', 'Refresh Stats')"
          >
            <span class="icon">🔄</span>
          </button>
        </div>
        
        <div class="fw-card__content">
           <div class="fw-status-row">
             <div class="fw-status-item">
               <span class="label">{{ t("cache-stats-entries", "Total entries") }}</span>
               <span class="fw-badge">{{ cacheStatsDisplay.entries }}</span>
             </div>
             <div class="fw-status-item">
               <span class="label">{{ t("cache-stats-size", "Total size") }}</span>
               <span class="fw-badge">{{ cacheStatsDisplay.size }}</span>
             </div>
             <div class="fw-status-item">
               <span class="label">{{ t("cache-stats-oldest", "Oldest entry") }}</span>
               <span class="fw-badge">{{ cacheStatsDisplay.oldest }}</span>
             </div>
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
</script>
