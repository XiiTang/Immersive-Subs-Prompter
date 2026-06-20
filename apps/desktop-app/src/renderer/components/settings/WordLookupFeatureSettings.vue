<template>
  <UiSection :title="t('feature-word-lookup-title')">
    <div class="feature-settings">
      <UiSettingRow id="feature-word-lookup-path" :label="t('feature-word-lookup-path')" control-width="wide">
        <div class="word-lookup-path-row">
          <UiInput
            :model-value="config.wordListPath"
            data-testid="feature-word-lookup-path"
            @update:model-value="update({ wordListPath: String($event) })"
          />
          <UiIconButton
            :label="t('button-select')"
            data-testid="feature-word-lookup-select-file"
            @click="selectFile"
          >
            <IconFolder size="sm" />
          </UiIconButton>
        </div>
      </UiSettingRow>
      <UiSettingRow id="feature-word-lookup-trigger" :label="t('feature-word-lookup-trigger')" control-width="field">
        <UiSelect
          :model-value="config.modifierKey"
          :options="modifierOptions"
          @update:model-value="update({ modifierKey: $event as 'alt' | 'ctrl' | 'shift' })"
        />
      </UiSettingRow>
      <div class="word-lookup-dimensions" data-testid="feature-word-lookup-dimensions">
        <UiField
          id="feature-word-lookup-width"
          density="compact"
          :label="t('feature-word-lookup-panel-width')"
          :value="`${config.panelWidth}px`"
        >
          <UiSlider
            :model-value="config.panelWidth"
            :min="260"
            :max="720"
            :step="1"
            :label="t('feature-word-lookup-panel-width')"
            @update:model-value="update({ panelWidth: $event })"
          />
        </UiField>
        <UiField
          id="feature-word-lookup-height"
          density="compact"
          :label="t('feature-word-lookup-panel-height')"
          :value="`${config.panelHeight}px`"
        >
          <UiSlider
            :model-value="config.panelHeight"
            :min="180"
            :max="640"
            :step="1"
            :label="t('feature-word-lookup-panel-height')"
            @update:model-value="update({ panelHeight: $event })"
          />
        </UiField>
      </div>
      <div class="word-lookup-actions">
        <UiButton
          size="sm"
          data-testid="feature-word-lookup-refresh"
          :disabled="isRefreshing"
          @click="refresh"
        >
          <IconRefresh size="sm" :class="{ 'icon--spinning': isRefreshing }" />
          {{ isRefreshing ? t("feature-word-lookup-refreshing") : t("feature-word-lookup-refresh") }}
        </UiButton>
      </div>
      <dl class="word-lookup-status" data-testid="feature-word-lookup-status">
        <div>
          <dt>{{ t("feature-word-lookup-status") }}</dt>
          <dd><UiBadge :tone="statusTone">{{ statusLabel }}</UiBadge></dd>
        </div>
        <div>
          <dt>{{ t("feature-word-lookup-entry-count") }}</dt>
          <dd>{{ status?.entryCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>{{ t("feature-word-lookup-file-modified") }}</dt>
          <dd>{{ formatTimestamp(status?.fileMtimeMs) }}</dd>
        </div>
        <div>
          <dt>{{ t("feature-word-lookup-loaded-at") }}</dt>
          <dd>{{ formatTimestamp(status?.loadedAt) }}</dd>
        </div>
      </dl>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { WordLookupFeatureConfig } from "../../../main/types";
import { DEFAULT_WORD_LOOKUP_FEATURE_CONFIG } from "../../../common/wordLookupDefaults";
import type { WordLookupStatus } from "../../../common/wordLookupTypes";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { IconFolder, IconRefresh } from "../icons";
import { UiBadge, UiButton, UiField, UiIconButton, UiInput, UiSection, UiSelect, UiSettingRow, UiSlider } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const config = computed(() => store.settings?.features.wordLookup.config ?? DEFAULT_WORD_LOOKUP_FEATURE_CONFIG);
const status = ref<WordLookupStatus | null>(null);
const isRefreshing = ref(false);
const modifierOptions = [
  { value: "alt", label: "Alt" },
  { value: "ctrl", label: "Ctrl" },
  { value: "shift", label: "Shift" }
];

const statusLabel = computed(() => {
  if (!status.value) {
    return t("feature-word-lookup-status-not-loaded");
  }
  return status.value.ok
    ? t("feature-word-lookup-status-ready")
    : status.value.error || t("feature-word-lookup-status-error");
});

const statusTone = computed(() => {
  if (!status.value) {
    return "neutral";
  }
  return status.value.ok ? "success" : "danger";
});

function update(patch: Partial<WordLookupFeatureConfig>) {
  void store.setFeatureConfig("wordLookup", patch);
}

async function loadStatus() {
  status.value = await window.usp.getWordLookupStatus();
}

async function refresh() {
  isRefreshing.value = true;
  try {
    status.value = await window.usp.refreshWordLookup();
  } finally {
    isRefreshing.value = false;
  }
}

async function selectFile() {
  const result = await window.usp.selectWordListFile();
  if (result.canceled || !result.path) {
    return;
  }
  await store.setFeatureConfig("wordLookup", { wordListPath: result.path });
  await refresh();
}

function formatTimestamp(value: number | null | undefined) {
  return value ? new Date(value).toLocaleString() : "-";
}

onMounted(loadStatus);
watch(() => config.value.wordListPath, loadStatus);
</script>

<style scoped>
.feature-settings {
  display: grid;
  gap: 10px;
}

.word-lookup-path-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.word-lookup-dimensions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  align-items: start;
  min-width: 0;
}

.word-lookup-actions {
  display: flex;
  justify-content: flex-start;
}

.word-lookup-status {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  margin: 0;
  padding: 10px;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
}

.word-lookup-status div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.word-lookup-status dt {
  color: var(--ui-text-muted);
  font-size: 12px;
}

.word-lookup-status dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.icon--spinning {
  animation: word-lookup-spin 0.9s linear infinite;
}

@keyframes word-lookup-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
