<template>
  <UiSection :title="t('section-cache', 'Subtitle Cache')">
    <template #actions>
      <UiSwitch v-model="cacheEnabled" :label="cacheEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
    </template>

    <div v-if="cacheEnabled" class="settings-stack" data-testid="cache-settings-stack">
      <div class="cache-field-row">
        <UiField id="cache-path" class="cache-field--grow" :label="t('cache-path-label', 'Cache Path')">
          <div class="ui-inline-control">
            <UiInput v-model="cachePath" />
            <UiIconButton :label="t('button-open-cache', 'Open Cache Folder')" @click="openCacheFolder">
              <IconFolder size="md" />
            </UiIconButton>
          </div>
        </UiField>

        <UiField id="cache-retention" class="cache-field--fixed" :label="t('cache-retention-label', 'Retention (days)')">
          <UiInput v-model="cacheRetentionDays" type="number" min="1" max="9999" step="1" />
        </UiField>
      </div>

      <div class="ui-stat-grid">
        <div class="ui-stat">
          <span class="ui-stat__label">{{ statLabel("cache-stats-entries", "Total entries") }}</span>
          <UiBadge>{{ cacheStatsDisplay.entries }}</UiBadge>
        </div>
        <div class="ui-stat">
          <span class="ui-stat__label">{{ statLabel("cache-stats-size", "Total size") }}</span>
          <UiBadge>{{ cacheStatsDisplay.size }}</UiBadge>
        </div>
        <div class="ui-stat">
          <span class="ui-stat__label">{{ statLabel("cache-stats-oldest", "Oldest entry") }}</span>
          <UiBadge>{{ cacheStatsDisplay.oldest }}</UiBadge>
          <UiIconButton
            data-testid="cache-stats-refresh"
            size="sm"
            :disabled="cacheBusy"
            :label="t('button-refresh-stats', 'Refresh Stats')"
            @click="refreshCacheStats"
          >
            <IconRefresh size="sm" :class="{ 'icon--spinning': cacheBusy }" />
          </UiIconButton>
        </div>
      </div>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { IconFolder, IconRefresh } from "../icons";
import { UiBadge, UiField, UiIconButton, UiInput, UiSection, UiSwitch } from "../ui";

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
