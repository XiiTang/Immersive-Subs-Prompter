<template>
  <UiSection :title="t('word-lookup-section-title', 'Word Lookup')">
    <UiField id="word-list-path" :label="t('word-lookup-path-label', 'Word List Path')" :hint="t('word-lookup-path-hint', 'JSONL rows with word, content, and optional aliases.')">
      <div class="ui-inline-control">
        <UiInput :model-value="config.wordListPath" @change="handlePathChange" />
        <UiButton variant="secondary" @click="selectFile">
          {{ t("word-lookup-select-file", "Select File") }}
        </UiButton>
      </div>
    </UiField>

    <UiField id="word-lookup-modifier" :label="t('word-lookup-modifier-label', 'Trigger Key')">
      <UiSelect :model-value="config.modifierKey" :options="modifierOptions" @update:model-value="handleModifierInput" />
    </UiField>

    <div class="word-lookup-settings__actions">
      <UiButton variant="primary" :disabled="isRefreshing" @click="refresh">
        {{ isRefreshing ? t("word-lookup-refreshing", "Refreshing...") : t("word-lookup-refresh", "Refresh") }}
      </UiButton>
    </div>

    <dl class="ui-stat-grid word-lookup-status">
      <div class="ui-stat">
        <dt class="ui-stat__label">{{ t("word-lookup-status-state", "Status") }}</dt>
        <dd>
          <UiBadge :tone="status && !status.ok ? 'danger' : 'success'">{{ statusLabel }}</UiBadge>
        </dd>
      </div>
      <div class="ui-stat">
        <dt class="ui-stat__label">{{ t("word-lookup-status-entries", "Entries") }}</dt>
        <dd><UiBadge>{{ status?.entryCount ?? 0 }}</UiBadge></dd>
      </div>
      <div class="ui-stat">
        <dt class="ui-stat__label">{{ t("word-lookup-status-mtime", "File Modified") }}</dt>
        <dd><UiBadge>{{ formatTimestamp(status?.fileMtimeMs) }}</UiBadge></dd>
      </div>
      <div class="ui-stat">
        <dt class="ui-stat__label">{{ t("word-lookup-status-loaded", "Loaded") }}</dt>
        <dd><UiBadge>{{ formatTimestamp(status?.loadedAt) }}</UiBadge></dd>
      </div>
    </dl>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { WORD_LOOKUP_PLUGIN_ID } from "../../../common/pluginIds.js";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import type { WordLookupPluginConfig, WordLookupStatus } from "../../plugins/wordLookupTypes";
import { UiBadge, UiButton, UiField, UiInput, UiSection, UiSelect } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const status = ref<WordLookupStatus | null>(null);
const isRefreshing = ref(false);

const config = computed(() => store.getWordLookupPluginConfig());
const modifierOptions = computed(() => [
  { value: "alt", label: t("word-lookup-modifier-alt", "Alt / Option") },
  { value: "ctrl", label: t("word-lookup-modifier-ctrl", "Ctrl / Command") },
  { value: "shift", label: t("word-lookup-modifier-shift", "Shift") }
]);
const statusLabel = computed(() => {
  if (!status.value) {
    return t("word-lookup-status-unknown", "Not loaded");
  }
  if (status.value.ok) {
    return t("word-lookup-status-ready", "Ready");
  }
  return status.value.error ?? t("word-lookup-status-error", "Error");
});

async function updateConfig(patch: Partial<WordLookupPluginConfig>) {
  await store.updateSettings({
    plugins: {
      [WORD_LOOKUP_PLUGIN_ID]: {
        config: {
          ...config.value,
          ...patch,
          panelSize: {
            ...config.value.panelSize,
            ...(patch.panelSize ?? {})
          }
        }
      }
    }
  });
}

async function refresh() {
  isRefreshing.value = true;
  try {
    status.value = await window.usp.refreshWordLookup();
  } finally {
    isRefreshing.value = false;
  }
}

async function loadStatus() {
  status.value = await window.usp.getWordLookupStatus();
}

async function selectFile() {
  const result = await window.usp.selectWordListFile();
  if (result.canceled || !result.path) return;
  await updateConfig({ wordListPath: result.path });
  await refresh();
}

async function handlePathChange(event: Event) {
  const value = event.target instanceof HTMLInputElement ? event.target.value : "";
  await updateConfig({ wordListPath: value });
  await refresh();
}

function handleModifierInput(value: string) {
  if (value === "alt" || value === "ctrl" || value === "shift") {
    void updateConfig({ modifierKey: value });
  }
}

function formatTimestamp(value: number | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

onMounted(loadStatus);

watch(() => store.isPluginEnabled(WORD_LOOKUP_PLUGIN_ID), (enabled) => {
  if (enabled) {
    loadStatus();
  }
});
</script>
