<template>
  <section class="settings-section">
    <header class="settings-section__intro">
      <div>
        <h3 class="settings-section__title">{{ t("section-global-settings", "Global Settings") }}</h3>
      </div>
    </header>

    <div class="settings-panel">
      <div class="settings-group">
        <div class="settings-group__header">
          <h4 class="settings-group__title">{{ t("global-general", "General") }}</h4>
        </div>

        <div class="settings-fields-grid settings-fields-grid--two-col">
          <div class="settings-field">
            <span class="settings-field__label">{{ t("language-label", "Language") }}</span>
            <select v-model="languageSetting" class="settings-select">
              <option value="en">{{ t("language-option-en", "English") }}</option>
              <option value="zh">{{ t("language-option-zh", "中文") }}</option>
            </select>
          </div>

          <div class="settings-field settings-field--inline">
            <span class="settings-field__label">{{ t("auto-start-label", "Auto Start") }}</span>
            <label class="toggle">
              <input type="checkbox" v-model="autoLaunch" />
              <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group__header">
          <h4 class="settings-group__title">{{ t("global-network", "Network & Connections") }}</h4>
        </div>

        <div class="settings-fields-grid settings-fields-grid--two-col">
          <div class="settings-field">
            <span class="settings-field__label">{{ t("network-host-label", "Bind Address") }}</span>
            <input type="text" v-model="serverHost" class="settings-input" spellcheck="false" placeholder="0.0.0.0" />
          </div>

          <div class="settings-field">
            <span class="settings-field__label">{{ t("network-port-label", "Port") }}</span>
            <input type="number" min="1" max="65535" v-model.number="serverPort" class="settings-input" />
          </div>
        </div>

        <div class="settings-note">
          <small class="settings-field__hint">
            {{ t("network-port-hint", "Changing host/port restarts the desktop WebSocket server.") }}
          </small>
          <small class="settings-field__hint">
            {{ t("network-host-hint", "Use 0.0.0.0 to allow phones/tablets on your LAN to connect.") }}
          </small>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group__header">
          <h4 class="settings-group__title">{{ t("global-shortcuts", "Shortcuts & Interaction") }}</h4>
        </div>

        <div class="settings-field settings-field--compact">
          <span class="settings-field__label">{{ t("toggle-shortcut-label", "Toggle Window Shortcut") }}</span>
          <input type="text" v-model="toggleShortcut" class="settings-input" placeholder="CommandOrControl+Shift+S" />
          <span class="settings-field__hint">{{ t("toggle-shortcut-hint", "Use modifiers with keys.") }}</span>
        </div>

        <div class="settings-field">
          <div class="settings-field-header">
            <span class="settings-field__label">{{ t("process-blacklist-label", "Process Blacklist") }}</span>
            <span class="settings-field__hint-inline">
              {{ t("process-blacklist-hint", "Disable shortcuts when these processes are foregrounded.") }}
            </span>
          </div>

          <div class="game-blacklist-editor__controls">
            <input
              type="text"
              v-model="gameProcessInput"
              class="settings-input"
              :placeholder="t('process-blacklist-placeholder', 'e.g.: r5apex_dx12.exe, csgo.exe, vlc.exe')"
              autocomplete="off"
              @keyup.enter="addGameProcess"
            />
            <button
              type="button"
              class="icon-button"
              :title="t('button-add', 'Add')"
              :aria-label="t('button-add', 'Add')"
              @click="addGameProcess"
            >
              <IconAdd size="md" />
            </button>
          </div>

          <div class="priority-editor__list" v-if="gameProcesses.length">
            <div v-for="process in gameProcesses" :key="process" class="priority-editor__item">
              <span>{{ process }}</span>
              <button
                type="button"
                class="priority-editor__item-remove"
                :aria-label="t('game-blacklist-remove', 'Remove')"
                @click="removeGameProcess(process)"
              >
                ✕
              </button>
            </div>
          </div>
          <div v-else class="priority-editor__empty">
            {{ t("game-blacklist-none", "No processes yet.") }}
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
import { IconAdd } from "../icons";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);



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
