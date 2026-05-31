<template>
  <UiSection :title="t('section-global-settings')">
    <div class="global-settings">
      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-general") }}</h3>

        <div class="global-settings__row global-settings__row--ui-field">
          <UiField id="language" class="global-settings__field" :label="t('language-label')" inline>
            <UiSelect v-model="languageSetting" :options="languageOptions" />
          </UiField>
        </div>

        <div class="global-settings__row global-settings__row--ui-field">
          <UiField id="appearance-theme" class="global-settings__field" :label="t('appearance-theme-label')" inline>
            <UiSegmentedControl
              v-model="appearanceTheme"
              :label="t('appearance-theme-label')"
              :options="themeOptions"
            />
          </UiField>
        </div>

        <div class="global-settings__row">
          <div class="global-settings__row-meta">
            <span id="auto-start-label" class="ui-field__label">{{ t("auto-start-label") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--compact">
            <UiSwitch v-model="autoLaunch" :label="autoLaunch ? t('toggle-on') : t('toggle-off')" />
          </div>
        </div>
      </section>

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-connectivity") }}</h3>

        <div class="global-settings__row global-settings__row--editor">
          <div class="global-settings__row-meta">
            <span class="ui-field__label">{{ t("network-endpoints-label") }}</span>
            <span class="ui-field__hint">{{ t("network-endpoints-hint") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--editor">
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
          </div>
        </div>
      </section>

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-shortcuts-section") }}</h3>

        <div class="global-settings__row">
          <div class="global-settings__row-meta">
            <span id="toggle-shortcut-label" class="ui-field__label">{{ t("toggle-shortcut-label") }}</span>
            <span id="toggle-shortcut-hint" class="ui-field__hint">{{ t("toggle-shortcut-hint") }}</span>
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
            <span class="ui-field__label">{{ t("process-blacklist-label") }}</span>
            <span class="ui-field__hint">{{ t("process-blacklist-hint") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--editor">
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
          </div>
        </div>
      </section>

      <section class="global-settings__group">
        <h3 class="global-settings__group-title">{{ t("global-cache") }}</h3>

        <div class="global-settings__row">
          <div class="global-settings__row-meta">
            <span id="cache-enabled-label" class="ui-field__label">{{ t("enable-cache-label") }}</span>
          </div>
          <div class="global-settings__control global-settings__control--compact">
            <UiSwitch v-model="cacheEnabled" :label="cacheEnabled ? t('toggle-on') : t('toggle-off')" />
          </div>
        </div>

        <template v-if="cacheEnabled">
          <div class="global-settings__row">
            <div class="global-settings__row-meta">
              <span id="cache-path-label" class="ui-field__label">{{ t("cache-path-label") }}</span>
              <span id="cache-path-hint" class="ui-field__hint">{{ t("cache-path-hint") }}</span>
            </div>
            <div class="global-settings__control global-settings__control--wide">
              <div class="ui-inline-control">
                <UiInput
                  v-model="cachePath"
                  aria-labelledby="cache-path-label"
                  aria-describedby="cache-path-hint"
                />
                <UiIconButton :label="t('button-open-cache')" @click="openCacheFolder">
                  <IconFolder size="md" />
                </UiIconButton>
              </div>
            </div>
          </div>

          <div class="global-settings__row">
            <div class="global-settings__row-meta">
              <span id="cache-retention-label" class="ui-field__label">{{ t("cache-retention-label") }}</span>
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
              <span class="ui-field__label">{{ t("cache-stats-label") }}</span>
            </div>
            <div class="global-settings__control global-settings__control--stats">
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
import { DEFAULT_CACHE_SETTINGS } from "../../../common/defaultSettings.js";
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

const cacheEnabled = computed({
  get: () => store.settings?.cache.enabled ?? true,
  set: (value: boolean) => store.updateCacheSetting("enabled", value)
});

const cachePath = computed({
  get: () => store.settings?.cache.path ?? "",
  set: (value: string) => store.updateCacheSetting("path", value)
});

const cacheRetentionDays = computed({
  get: () => store.settings?.cache.retentionDays ?? DEFAULT_CACHE_SETTINGS.retentionDays,
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

function statLabel(key: string): string {
  return t(key).replace(/[：:]\s*$/, "");
}
</script>
