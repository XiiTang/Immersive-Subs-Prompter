<template>
  <section class="settings-section">
    <header class="settings-section__intro">
      <div>
        <h3 class="settings-section__title">{{ t("word-lookup-section-title", "Word Lookup") }}</h3>
      </div>
    </header>

    <div class="settings-surface word-lookup-settings">
      <label class="settings-field">
        <div class="settings-field__label-row">
          <span class="settings-field__label">{{ t("word-lookup-path-label", "Word List Path") }}</span>
          <small class="settings-field__hint">{{ t("word-lookup-path-hint", "JSONL rows with word, content, and optional aliases.") }}</small>
        </div>
        <div class="word-lookup-settings__path-row">
          <input type="text" :value="config.wordListPath" @change="handlePathChange" />
          <button type="button" class="btn-secondary" @click="selectFile">
            {{ t("word-lookup-select-file", "Select File") }}
          </button>
        </div>
      </label>

      <label class="settings-field">
        <span class="settings-field__label">{{ t("word-lookup-modifier-label", "Trigger Key") }}</span>
        <select :value="config.modifierKey" @change="handleModifierChange">
          <option value="alt">{{ t("word-lookup-modifier-alt", "Alt / Option") }}</option>
          <option value="ctrl">{{ t("word-lookup-modifier-ctrl", "Ctrl / Command") }}</option>
          <option value="shift">{{ t("word-lookup-modifier-shift", "Shift") }}</option>
        </select>
      </label>

      <div class="word-lookup-settings__actions">
        <button type="button" class="btn-primary" @click="refresh" :disabled="isRefreshing">
          {{ isRefreshing ? t("word-lookup-refreshing", "Refreshing...") : t("word-lookup-refresh", "Refresh") }}
        </button>
      </div>

      <dl class="word-lookup-status">
        <div>
          <dt>{{ t("word-lookup-status-state", "Status") }}</dt>
          <dd :class="{ 'word-lookup-status__error': status && !status.ok }">
            {{ statusLabel }}
          </dd>
        </div>
        <div>
          <dt>{{ t("word-lookup-status-entries", "Entries") }}</dt>
          <dd>{{ status?.entryCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>{{ t("word-lookup-status-mtime", "File Modified") }}</dt>
          <dd>{{ formatTimestamp(status?.fileMtimeMs) }}</dd>
        </div>
        <div>
          <dt>{{ t("word-lookup-status-loaded", "Loaded") }}</dt>
          <dd>{{ formatTimestamp(status?.loadedAt) }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { WORD_LOOKUP_PLUGIN_ID } from "../../../common/pluginIds.js";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import type { WordLookupPluginConfig, WordLookupStatus } from "../../plugins/wordLookupTypes";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const status = ref<WordLookupStatus | null>(null);
const isRefreshing = ref(false);

const config = computed(() => store.getWordLookupPluginConfig());
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

function handleModifierChange(event: Event) {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : config.value.modifierKey;
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
