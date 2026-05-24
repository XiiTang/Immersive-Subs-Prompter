<template>
  <UiSection :title="t('section-global-settings', 'Global Settings')">
    <div class="global-settings">
      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-general", "General") }}</h3>

        <div class="global-settings__row global-settings__row--ui-field">
          <UiField id="language" class="global-settings__field" :label="t('language-label', 'Language')" inline>
            <UiSelect v-model="languageSetting" :options="languageOptions" />
          </UiField>
        </div>

        <div class="global-settings__row">
          <div class="global-settings__row-meta">
            <span id="auto-start-label" class="ui-field__label">{{ t("auto-start-label", "Auto Start") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--compact">
            <UiSwitch v-model="autoLaunch" :label="autoLaunch ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
          </div>
        </div>
      </section>

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-connectivity", "Connectivity") }}</h3>

        <div class="global-settings__row global-settings__row--editor">
          <div class="global-settings__row-meta">
            <span class="ui-field__label">{{ t("network-endpoints-label", "Listening Endpoints") }}</span>
            <span class="ui-field__hint">{{ t("network-endpoints-hint", "Add explicit addresses such as 127.0.0.1:44501 or 192.168.1.2:44501.") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--editor">
            <NetworkEndpointEditor
              hide-header
              :endpoints="networkEndpoints"
              :auth-token="networkAuthToken"
              :listener-statuses="networkListenerStatuses"
              :label="t('network-endpoints-label', 'Listening Endpoints')"
              :hint="t('network-endpoints-hint', 'Add explicit addresses such as 127.0.0.1:44501 or 192.168.1.2:44501.')"
              :placeholder="t('network-endpoints-placeholder', '127.0.0.1:44501')"
              :remove-label="t('network-endpoint-remove', 'Remove endpoint')"
              @update:endpoints="updateNetworkEndpoints"
            />
          </div>
        </div>
      </section>

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-shortcuts-section", "Shortcuts") }}</h3>

        <div class="global-settings__row">
          <div class="global-settings__row-meta">
            <span id="toggle-shortcut-label" class="ui-field__label">{{ t("toggle-shortcut-label", "Toggle Window Shortcut") }}</span>
            <span id="toggle-shortcut-hint" class="ui-field__hint">{{ t("toggle-shortcut-hint", "Use modifiers with keys.") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--field">
            <ShortcutInput
              v-model="toggleShortcut"
              aria-labelledby="toggle-shortcut-label"
              aria-describedby="toggle-shortcut-hint"
              data-testid="toggle-shortcut-input"
              placeholder="CommandOrControl+Shift+S"
            />
          </div>
        </div>

        <div class="global-settings__row global-settings__row--editor">
          <div class="global-settings__row-meta">
            <span class="ui-field__label">{{ t("process-blacklist-label", "Process Blacklist") }}</span>
            <span class="ui-field__hint">{{ t("process-blacklist-hint", "Disable shortcuts when these processes are foregrounded.") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--editor">
            <PillListEditor
              hide-header
              :label="t('process-blacklist-label', 'Process Blacklist')"
              :hint="t('process-blacklist-hint', 'Disable shortcuts when these processes are foregrounded.')"
              :items="gameProcessItems"
              :draft-value="gameProcessInput"
              :placeholder="t('process-blacklist-placeholder', 'e.g.: r5apex_dx12.exe')"
              :remove-label="t('game-blacklist-remove', 'Remove')"
              draft-test-id="process-blacklist-draft-input"
              display-test-id-prefix="process-blacklist-display"
              remove-test-id-prefix="process-blacklist-remove"
              @update:draft-value="gameProcessInput = $event"
              @add-draft="addGameProcess"
              @remove="removeGameProcess"
            />
          </div>
        </div>
      </section>

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("section-appearance", "Appearance") }}</h3>

        <div class="global-settings__row">
          <div class="global-settings__row-meta">
            <span id="appearance-theme-label" class="ui-field__label">{{ t("appearance-theme-label", "Theme") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--wide">
            <UiSegmentedControl
              v-model="appearanceTheme"
              :label="t('appearance-theme-label', 'Theme')"
              :options="themeOptions"
            />
          </div>
        </div>
      </section>

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-cache", "Cache") }}</h3>

        <div class="global-settings__row">
          <div class="global-settings__row-meta">
            <span id="cache-enabled-label" class="ui-field__label">{{ t("enable-cache-label", "Enable Cache") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--compact">
            <UiSwitch v-model="cacheEnabled" :label="cacheEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
          </div>
        </div>

        <template v-if="cacheEnabled">
          <div class="global-settings__row">
            <div class="global-settings__row-meta">
              <span id="cache-path-label" class="ui-field__label">{{ t("cache-path-label", "Cache Path") }}</span>
              <span id="cache-path-hint" class="ui-field__hint">{{ t("cache-path-hint", "Leave blank to use the default location.") }}</span>
            </div>
            <div class="global-settings__control global-settings__control--wide">
              <div class="ui-inline-control">
                <UiInput
                  v-model="cachePath"
                  aria-labelledby="cache-path-label"
                  aria-describedby="cache-path-hint"
                />
                <UiIconButton :label="t('button-open-cache', 'Open Cache Folder')" @click="openCacheFolder">
                  <IconFolder size="md" />
                </UiIconButton>
              </div>
            </div>
          </div>

          <div class="global-settings__row">
            <div class="global-settings__row-meta">
              <span id="cache-retention-label" class="ui-field__label">{{ t("cache-retention-label", "Retention (days)") }}</span>
            </div>
            <div class="global-settings__control global-settings__control--compact">
              <UiInput
                v-model="cacheRetentionDays"
                type="number"
                min="1"
                max="9999"
                step="1"
                aria-labelledby="cache-retention-label"
              />
            </div>
          </div>

          <div class="global-settings__row global-settings__row--stats">
            <div class="global-settings__row-meta">
              <span class="ui-field__label">{{ t("cache-stats-label", "Cache Stats") }}</span>
            </div>
            <div class="global-settings__control global-settings__control--stats">
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
          </div>
        </template>
      </section>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { AppearanceTheme, NetworkEndpoint } from "../../../main/types";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { IconFolder, IconRefresh } from "../icons";
import { UiBadge, UiField, UiIconButton, UiInput, UiSection, UiSegmentedControl, UiSelect, UiSwitch } from "../ui";
import NetworkEndpointEditor from "./NetworkEndpointEditor.vue";
import PillListEditor from "./PillListEditor.vue";
import ShortcutInput from "./ShortcutInput.vue";
import type { PillListEditorItem } from "./pillListEditorTypes";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const languageOptions = computed(() => [
  { value: "en", label: t("language-option-en", "English") },
  { value: "zh", label: t("language-option-zh", "中文") }
]);

const themeOptions = computed<Array<{ value: AppearanceTheme; label: string }>>(() => [
  { value: "system", label: t("appearance-theme-system", "System") },
  { value: "light", label: t("appearance-theme-light", "Light") },
  { value: "dark", label: t("appearance-theme-dark", "Dark") }
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
