<template>
  <UiSection :title="t('section-global-settings')">
    <div class="global-settings">
      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-general") }}</h3>

        <UiSettingRow id="language" :label="t('language-label')" control-width="field">
          <UiSelect v-model="languageSetting" :options="languageOptions" />
        </UiSettingRow>

        <UiSettingRow id="appearance-theme" :label="t('appearance-theme-label')" control-width="field">
          <UiSegmentedControl
            v-model="appearanceTheme"
            :label="t('appearance-theme-label')"
            :options="themeOptions"
          />
        </UiSettingRow>

        <UiSettingRow id="auto-start" :label="t('auto-start-label')" control-width="compact">
          <UiSwitch v-model="autoLaunch" :label="autoLaunch ? t('toggle-on') : t('toggle-off')" />
        </UiSettingRow>
      </section>

      <SettingsReleaseUpdate />

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-connectivity") }}</h3>

        <UiSettingRow
          id="network-endpoints"
          :label="t('network-endpoints-label')"
          :hint="t('network-endpoints-hint')"
          control-width="editor"
        >
          <NetworkEndpointEditor
            hide-header
            :endpoints="networkEndpoints"
            :auth-token="networkAuthToken"
            :listener-statuses="networkListenerStatuses"
            :label="t('network-endpoints-label')"
            :hint="t('network-endpoints-hint')"
            :placeholder="t('network-endpoints-placeholder')"
            :remove-label="t('network-endpoint-remove')"
            @update:endpoints="updateNetworkEndpoints"
          />
        </UiSettingRow>
      </section>

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-shortcuts-section") }}</h3>

        <UiSettingRow
          id="toggle-shortcut"
          :label="t('toggle-shortcut-label')"
          :hint="t('toggle-shortcut-hint')"
          control-width="field"
        >
          <ShortcutInput
            v-model="toggleShortcut"
            data-testid="toggle-shortcut-input"
            placeholder="CommandOrControl+Shift+S"
          />
        </UiSettingRow>

        <UiSettingRow
          id="process-blacklist"
          :label="t('process-blacklist-label')"
          :hint="t('process-blacklist-hint')"
          control-width="editor"
        >
          <PillListEditor
            hide-header
            :label="t('process-blacklist-label')"
            :hint="t('process-blacklist-hint')"
            :items="gameProcessItems"
            :draft-value="gameProcessInput"
            :placeholder="t('process-blacklist-placeholder')"
            :remove-label="t('game-blacklist-remove')"
            draft-test-id="process-blacklist-draft-input"
            display-test-id-prefix="process-blacklist-display"
            remove-test-id-prefix="process-blacklist-remove"
            @update:draft-value="gameProcessInput = $event"
            @add-draft="addGameProcess"
            @remove="removeGameProcess"
          />
        </UiSettingRow>
      </section>

      <section class="global-settings__group">
        <div class="global-settings__group-heading">
          <h3 class="global-settings__group-title">{{ t("global-cache") }}</h3>
          <UiSwitch v-model="cacheEnabled" :label="t('global-cache')" :show-label="false" />
        </div>

        <template v-if="cacheEnabled">
          <UiSettingRow
            id="cache-path"
            :label="t('cache-path-label')"
            control-width="wide"
          >
            <div class="ui-inline-control">
              <UiInput
                v-model="cachePath"
                :placeholder="t('cache-path-placeholder')"
              />
              <UiIconButton :label="t('button-open-cache')" @click="openCacheFolder">
                <IconFolder size="md" />
              </UiIconButton>
            </div>
          </UiSettingRow>

          <UiSettingRow id="cache-retention" :label="t('cache-retention-label')" control-width="compact">
            <UiInput
              :model-value="cacheRetentionDaysDraft"
              type="number"
              min="1"
              max="9999"
              step="1"
              @update:model-value="updateCacheRetentionDaysDraft(String($event))"
            />
          </UiSettingRow>

          <UiSettingRow id="cache-stats" :label="t('cache-stats-label')" control-width="stats">
            <div class="ui-stat-grid">
              <div class="ui-stat">
                <span class="ui-stat__label">{{ statLabel("cache-stats-entries") }}</span>
                <UiBadge>{{ cacheStatsDisplay.entries }}</UiBadge>
              </div>
              <div class="ui-stat">
                <span class="ui-stat__label">{{ statLabel("cache-stats-size") }}</span>
                <UiBadge>{{ cacheStatsDisplay.size }}</UiBadge>
              </div>
              <div class="ui-stat">
                <span class="ui-stat__label">{{ statLabel("cache-stats-oldest") }}</span>
                <UiBadge>{{ cacheStatsDisplay.oldest }}</UiBadge>
                <UiIconButton
                  data-testid="cache-stats-refresh"
                  size="sm"
                  :disabled="cacheBusy"
                  :label="t('button-refresh-stats')"
                  @click="refreshCacheStats"
                >
                  <IconRefresh size="sm" :class="{ 'icon--spinning': cacheBusy }" />
                </UiIconButton>
              </div>
            </div>
          </UiSettingRow>
        </template>
      </section>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AppearanceTheme, NetworkEndpoint } from "../../../main/types";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { DEFAULT_CACHE_SETTINGS } from "../../../common/defaultSettings.js";
import { IconFolder, IconRefresh } from "../icons";
import {
  UiBadge,
  UiIconButton,
  UiInput,
  UiSection,
  UiSegmentedControl,
  UiSelect,
  UiSettingRow,
  UiSwitch
} from "../ui";
import NetworkEndpointEditor from "./NetworkEndpointEditor.vue";
import PillListEditor from "./PillListEditor.vue";
import SettingsReleaseUpdate from "./SettingsReleaseUpdate.vue";
import ShortcutInput from "./ShortcutInput.vue";
import type { PillListEditorItem } from "./pillListEditorTypes";
import { parseBoundedNumberDraft } from "./numericDraft";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const languageOptions = computed(() => [
  { value: "en", label: t("language-option-en") },
  { value: "zh", label: t("language-option-zh") }
]);

const themeOptions = computed<Array<{ value: AppearanceTheme; label: string }>>(() => [
  { value: "system", label: t("appearance-theme-system") },
  { value: "light", label: t("appearance-theme-light") },
  { value: "dark", label: t("appearance-theme-dark") }
]);

const autoLaunch = computed({
  get: () => store.settings?.global.autoLaunch ?? false,
  set: (value: boolean) => store.updateGlobalSetting("autoLaunch", value)
});

const toggleShortcut = computed({
  get: () => store.settings?.global.toggleWindowShortcut ?? "",
  set: (value: string) => store.updateGlobalSetting("toggleWindowShortcut", value)
});

const networkEndpoints = computed(() => store.settings?.network.endpoints ?? []);
const networkAuthToken = computed(() => store.settings?.network.authToken ?? "");
const networkListenerStatuses = computed(() => store.desktopState?.networkListeners ?? []);

function updateNetworkEndpoints(endpoints: NetworkEndpoint[]) {
  store.updateNetworkSetting("endpoints", endpoints);
}

const languageSetting = computed({
  get: () => language.value,
  set: (value: string) => store.updateGlobalSetting("language", value)
});

const appearanceTheme = computed<AppearanceTheme>({
  get: () => store.settings?.global.appearance.theme ?? "system",
  set: (theme) => {
    const current = store.settings?.global.appearance ?? { theme: "system" };
    store.updateGlobalSetting("appearance", { ...current, theme });
  }
});

const gameProcessInput = ref("");
const gameProcesses = computed(() => store.settings?.global.gameProcessBlacklist ?? []);
const gameProcessItems = computed<PillListEditorItem[]>(() =>
  gameProcesses.value.map((process) => ({
    id: process,
    label: process,
    title: process
  }))
);

function addGameProcess() {
  store.addGameProcess(gameProcessInput.value);
  gameProcessInput.value = "";
}

function removeGameProcess(name: string) {
  store.removeGameProcess(name);
}

const cacheBusy = ref(false);
const cacheRetentionDaysDraft = ref("");

const cacheEnabled = computed({
  get: () => store.settings?.cache.enabled ?? true,
  set: (value: boolean) => store.updateCacheSetting("enabled", value)
});

const cachePath = computed({
  get: () => store.settings?.cache.path ?? "",
  set: (value: string) => store.updateCacheSetting("path", value)
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

function updateCacheRetentionDaysDraft(value: string) {
  cacheRetentionDaysDraft.value = value;
  const retentionDays = parseBoundedNumberDraft(value, 1, 9999);
  if (retentionDays !== null) {
    store.updateCacheSetting("retentionDays", retentionDays);
  }
}

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

function statLabel(key: string): string {
  return t(key).replace(/[：:]\s*$/, "");
}

watch(
  () => store.settings?.cache.retentionDays ?? DEFAULT_CACHE_SETTINGS.retentionDays,
  (retentionDays) => {
    cacheRetentionDaysDraft.value = String(retentionDays);
  },
  { immediate: true }
);
</script>
