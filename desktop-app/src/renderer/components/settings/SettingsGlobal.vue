<template>
  <section class="settings-section">
    <h3 class="settings-section__title">{{ t("section-global-settings", "Global Settings") }}</h3>

    <div class="settings-grid">
      <!-- Card 1: General Application Settings -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__title">{{ t("global-general", "General") }}</div>
        </div>
        <div class="settings-card__content">
          <div class="settings-field">
            <span class="settings-field__label">{{ t("language-label", "Language") }}</span>
            <select v-model="languageSetting" class="settings-select">
              <option value="en">{{ t("language-option-en", "English") }}</option>
              <option value="zh">{{ t("language-option-zh", "中文") }}</option>
            </select>
            <small class="settings-field__hint">{{ t("language-hint", "Select interface language.") }}</small>
          </div>

          <div class="settings-field">
            <span class="settings-field__label">{{ t("close-behavior-label", "Close Behavior") }}</span>
            <select v-model="closeBehavior" class="settings-select">
              <option value="tray">{{ t("close-behavior-tray", "Minimize to tray on close") }}</option>
              <option value="quit">{{ t("close-behavior-quit", "Quit application") }}</option>
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

      <!-- Card 1.5: Network Configuration -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__title">{{ t("global-network", "Network & Connections") }}</div>
        </div>
        <div class="settings-card__content">
          <div class="settings-field">
            <span class="settings-field__label">{{ t("network-host-label", "Bind Address") }}</span>
            <input
              type="text"
              v-model="serverHost"
              class="settings-input"
              spellcheck="false"
              placeholder="0.0.0.0"
            />
            <small class="settings-field__hint">
              {{ t("network-host-hint", "Use 0.0.0.0 to allow phones/tablets on your LAN to connect.") }}
            </small>
          </div>

          <div class="settings-field">
            <span class="settings-field__label">{{ t("network-port-label", "Port") }}</span>
            <input
              type="number"
              min="1"
              max="65535"
              v-model.number="serverPort"
              class="settings-input"
            />
            <small class="settings-field__hint">
              {{ t("network-port-hint", "Changing host/port restarts the desktop WebSocket server.") }}
            </small>
          </div>
        </div>
      </div>

      <!-- Card 2: Auto-Hide Configuration -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__title">{{ t("global-autohide", "Auto-Hide Behavior") }}</div>
        </div>
        <div class="settings-card__content">
          <div class="settings-row two-col">
            <div class="settings-field settings-field--inline">
              <span class="settings-field__label">{{ t("auto-hide-panels-label", "Auto-hide Panels") }}</span>
              <label class="toggle">
                <input type="checkbox" v-model="autoHidePanels" />
                <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
              </label>
            </div>
            <div class="settings-field settings-field--inline">
              <span class="settings-field__label">{{ t("auto-hide-timestamps-label", "Timestamps") }}</span>
              <label class="toggle">
                <input type="checkbox" v-model="autoHideTimestamps" />
                <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
              </label>
            </div>
          </div>

          <div class="settings-field">
            <div class="settings-field-header">
              <span class="settings-field__label">{{ t("auto-hide-label", "Trigger Area Height") }}</span>
              <span class="value-badge">{{ autoHideHeight }}px</span>
            </div>
            <input
              type="range"
              min="80"
              max="600"
              step="10"
              class="slider"
              v-model.number="autoHideHeight"
              @pointerdown="emit('preview-auto-hide', true)"
              @pointerup="emit('preview-auto-hide', false)"
              @pointercancel="emit('preview-auto-hide', false)"
              @blur="emit('preview-auto-hide', false)"
            />
          </div>
        </div>
      </div>

      <!-- Card 3: Shortcuts & Interactions -->
      <div class="settings-card settings-card--full-width">
        <div class="settings-card__header">
          <div class="settings-card__title">{{ t("global-shortcuts", "Shortcuts & Interaction") }}</div>
        </div>
        <div class="settings-card__content">
          <div class="settings-row two-col">
            <div class="settings-field">
              <span class="settings-field__label">{{ t("toggle-shortcut-label", "Toggle Window Shortcut") }}</span>
              <input type="text" v-model="toggleShortcut" class="settings-input" placeholder="CommandOrControl+Shift+S" />
              <span class="settings-field__hint">{{ t("toggle-shortcut-hint", "Use modifiers with keys.") }}</span>
            </div>
            <!-- Spacer or another setting could go here -->
             <div></div>
          </div>

          <div class="settings-field">
            <div class="settings-field-header">
              <span class="settings-field__label">{{ t("process-blacklist-label", "Process Blacklist") }}</span>
              <small class="settings-field__hint">
                {{ t("process-blacklist-hint", "Disable shortcuts when these processes are foregrounded.") }}
              </small>
            </div>
            
            <div class="game-blacklist-editor__controls">
              <input
                type="text"
                v-model="gameProcessInput"
                class="settings-input"
                :placeholder="t('primary-priority-placeholder', 'e.g.: cyberpunk2077.exe')"
                autocomplete="off"
                @keyup.enter="addGameProcess"
              />
              <button type="button" class="btn-primary" @click="addGameProcess">
                {{ t("button-add", "Add") }}
              </button>
            </div>

            <div class="priority-editor__list" v-if="gameProcesses.length">
               <div
                v-for="process in gameProcesses"
                :key="process"
                class="priority-editor__item"
              >
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
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";

const emit = defineEmits<{
  (e: "preview-auto-hide", visible: boolean): void;
}>();

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const closeBehavior = computed({
  get: () => store.settings?.global.closeBehavior ?? "tray",
  set: (value: "tray" | "quit") => store.updateGlobalSetting("closeBehavior", value)
});

const autoLaunch = computed({
  get: () => store.settings?.global.autoLaunch ?? false,
  set: (value: boolean) => store.updateGlobalSetting("autoLaunch", value)
});

const toggleShortcut = computed({
  get: () => store.settings?.global.toggleWindowShortcut ?? "",
  set: (value: string) => store.updateGlobalSetting("toggleWindowShortcut", value)
});

const autoHidePanels = computed({
  get: () => store.settings?.global.autoHidePanels ?? false,
  set: (value: boolean) => store.updateGlobalSetting("autoHidePanels", value)
});

const serverHost = computed({
  get: () => store.settings?.network.host ?? "127.0.0.1",
  set: (value: string) => store.updateNetworkSetting("host", value)
});

const serverPort = computed({
  get: () => store.settings?.network.port ?? 44501,
  set: (value: number) => store.updateNetworkSetting("port", value)
});

const autoHideTimestamps = computed({
  get: () => store.settings?.global.autoHideTimestamps ?? false,
  set: (value: boolean) => store.updateGlobalSetting("autoHideTimestamps", value)
});

const autoHideHeight = computed({
  get: () => store.autoHideZoneHeight,
  set: (value: number) => store.updateGlobalSetting("autoHideActiveZoneHeight", value)
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
