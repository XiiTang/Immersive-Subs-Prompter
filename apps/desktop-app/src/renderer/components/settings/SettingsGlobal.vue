<template>
  <UiSection :title="t('section-global-settings', 'Global Settings')">
    <div class="settings-stack">
      <div class="settings-fields-grid settings-fields-grid--two-col">
        <UiField id="language" :label="t('language-label', 'Language')">
          <UiSelect v-model="languageSetting" :options="languageOptions" />
        </UiField>

        <UiField id="auto-start" :label="t('auto-start-label', 'Auto Start')" inline>
          <UiSwitch v-model="autoLaunch" :label="autoLaunch ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
        </UiField>
      </div>

      <NetworkEndpointEditor
        :endpoints="networkEndpoints"
        :auth-token="networkAuthToken"
        :listener-statuses="networkListenerStatuses"
        :label="t('network-endpoints-label', 'Listening Endpoints')"
        :hint="t('network-endpoints-hint', 'Add explicit addresses such as 127.0.0.1:44501 or 192.168.1.2:44501.')"
        :placeholder="t('network-endpoints-placeholder', '127.0.0.1:44501')"
        :remove-label="t('network-endpoint-remove', 'Remove endpoint')"
        @update:endpoints="updateNetworkEndpoints"
      />

      <UiField id="toggle-shortcut" :label="t('toggle-shortcut-label', 'Toggle Window Shortcut')" :hint="t('toggle-shortcut-hint', 'Use modifiers with keys.')">
        <UiInput v-model="toggleShortcut" placeholder="CommandOrControl+Shift+S" />
      </UiField>

      <PillListEditor
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
  </UiSection>
  <SettingsAppearance />
  <SettingsCache />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { NetworkEndpoint } from "../../../main/types";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { UiField, UiInput, UiSection, UiSelect, UiSwitch } from "../ui";
import SettingsAppearance from "./SettingsAppearance.vue";
import SettingsCache from "./SettingsCache.vue";
import NetworkEndpointEditor from "./NetworkEndpointEditor.vue";
import PillListEditor from "./PillListEditor.vue";
import type { PillListEditorItem } from "./pillListEditorTypes";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const languageOptions = computed(() => [
  { value: "en", label: t("language-option-en", "English") },
  { value: "zh", label: t("language-option-zh", "中文") }
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
</script>
