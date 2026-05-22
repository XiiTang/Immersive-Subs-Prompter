<template>
  <UiSection :title="t('section-global-settings', 'Global Settings')">
    <div class="settings-panel">
      <div class="settings-fields-grid settings-fields-grid--two-col">
        <UiField id="language" :label="t('language-label', 'Language')">
          <UiSelect v-model="languageSetting" :options="languageOptions" />
        </UiField>

        <UiField id="auto-start" :label="t('auto-start-label', 'Auto Start')" inline>
          <UiSwitch v-model="autoLaunch" :label="autoLaunch ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
        </UiField>
      </div>

      <div class="settings-fields-grid settings-fields-grid--two-col">
        <UiField id="network-host" :label="t('network-host-label', 'Bind Address')" :hint="t('network-host-hint', 'Use 0.0.0.0 only when another extension client must connect over your LAN.')">
          <UiInput v-model="serverHost" placeholder="127.0.0.1" />
        </UiField>

        <UiField id="network-port" :label="t('network-port-label', 'Port')" :hint="t('network-port-hint', 'Changing host/port restarts the desktop WebSocket server.')">
          <UiInput v-model="serverPort" type="number" min="1" max="65535" />
        </UiField>

        <UiField id="network-endpoint" class="settings-field--wide" :label="t('network-endpoint-label', 'Extension Endpoint')" :hint="t('network-endpoint-hint', 'Use this full URL when the bind address is reachable from another device.')">
          <UiInput :model-value="extensionEndpoint" readonly />
        </UiField>
      </div>

      <UiField id="toggle-shortcut" :label="t('toggle-shortcut-label', 'Toggle Window Shortcut')" :hint="t('toggle-shortcut-hint', 'Use modifiers with keys.')">
        <UiInput v-model="toggleShortcut" placeholder="CommandOrControl+Shift+S" />
      </UiField>

      <UiField id="process-blacklist" :label="t('process-blacklist-label', 'Process Blacklist')" :hint="t('process-blacklist-hint', 'Disable shortcuts when these processes are foregrounded.')">
        <div class="ui-inline-control">
          <UiInput
            v-model="gameProcessInput"
            :placeholder="t('process-blacklist-placeholder', 'e.g.: r5apex_dx12.exe, csgo.exe, vlc.exe')"
            @keyup.enter="addGameProcess"
          />
          <UiIconButton :label="t('button-add', 'Add')" @click="addGameProcess">
            <IconAdd size="md" />
          </UiIconButton>
        </div>
      </UiField>

      <div v-if="gameProcesses.length" class="ui-chip-list">
        <span v-for="process in gameProcesses" :key="process" class="ui-chip">
          {{ process }}
          <button type="button" class="ui-chip__remove" :aria-label="t('game-blacklist-remove', 'Remove')" @click="removeGameProcess(process)">
            x
          </button>
        </span>
      </div>
      <UiEmptyState v-else :message="t('game-blacklist-none', 'No processes yet.')" />
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { IconAdd } from "../icons";
import { UiEmptyState, UiField, UiIconButton, UiInput, UiSection, UiSelect, UiSwitch } from "../ui";

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


const serverHost = computed({
  get: () => store.settings?.network.host ?? "127.0.0.1",
  set: (value: string) => store.updateNetworkSetting("host", value)
});

const serverPort = computed({
  get: () => store.settings?.network.port ?? 44501,
  set: (value: number) => store.updateNetworkSetting("port", value)
});

const extensionEndpoint = computed(() => {
  const host = serverHost.value || "127.0.0.1";
  const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  try {
    const url = new URL(`ws://${formattedHost}:${serverPort.value}/`);
    if (!isLoopbackHost(host)) {
      const token = store.settings?.network.authToken ?? "";
      if (token) {
        url.searchParams.set("token", token);
      }
    }
    return url.toString();
  } catch (error) {
    void error;
    return "";
  }
});

function isLoopbackHost(host: string): boolean {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host.trim().toLowerCase());
}

const languageSetting = computed({
  get: () => language.value,
  set: (value: string) => store.updateGlobalSetting("language", value)
});

const gameProcessInput = ref("");
const gameProcesses = computed(() => store.settings?.global.gameProcessBlacklist ?? []);

function addGameProcess() {
  store.addGameProcess(gameProcessInput.value);
  gameProcessInput.value = "";
}

function removeGameProcess(name: string) {
  store.removeGameProcess(name);
}
</script>
