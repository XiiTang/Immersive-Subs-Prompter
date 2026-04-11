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
          <div class="settings-row two-col">
            <div class="settings-field">
              <span class="settings-field__label">{{ t("network-host-label", "Bind Address") }}</span>
              <input
                type="text"
                v-model="serverHost"
                class="settings-input"
                spellcheck="false"
                placeholder="0.0.0.0"
              />
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
            </div>
          </div>
          
          <div class="settings-info-box">
             <small class="settings-field__hint">
              {{ t("network-port-hint", "Changing host/port restarts the desktop WebSocket server.") }}
            </small>
            <small class="settings-field__hint">
              {{ t("network-host-hint", "Use 0.0.0.0 to allow phones/tablets on your LAN to connect.") }}
            </small>
          </div>
        </div>
      </div>


      <!-- Card 3: Shortcuts & Interactions -->
      <div class="settings-card settings-card--full-width">
        <div class="settings-card__header">
          <div class="settings-card__title">{{ t("global-shortcuts", "Shortcuts & Interaction") }}</div>
        </div>
        <div class="settings-card__content">
          <div class="settings-row">
            <div class="settings-field" style="max-width: 50%;">
              <span class="settings-field__label">{{ t("toggle-shortcut-label", "Toggle Window Shortcut") }}</span>
              <input type="text" v-model="toggleShortcut" class="settings-input" placeholder="CommandOrControl+Shift+S" />
              <span class="settings-field__hint">{{ t("toggle-shortcut-hint", "Use modifiers with keys.") }}</span>
            </div>
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

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.settings-card {
  background: rgba(255, 255, 255, calc(0.02 * var(--panel-opacity-factor)));
  border: 1px solid rgba(255, 255, 255, calc(0.08 * var(--panel-opacity-factor)));
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-card--full-width {
  grid-column: 1 / -1;
}

.settings-card__header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, calc(0.04 * var(--panel-opacity-factor)));
  background: rgba(0, 0, 0, calc(0.15 * var(--panel-opacity-factor)));
}

.settings-card__title {
  font-size: 13px;
  font-weight: 600;
  color: #e5e5e5;
}

.settings-card__content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.settings-row {
  display: flex;
  gap: 12px;
}

.settings-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-field--inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, calc(0.03 * var(--panel-opacity-factor)));
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, calc(0.05 * var(--panel-opacity-factor)));
}

.settings-field-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.settings-select,
.settings-input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, calc(0.12 * var(--panel-opacity-factor)));
  background: rgba(0, 0, 0, calc(0.3 * var(--panel-opacity-factor)));
  color: #f5f5f5;
  font-size: 13px;
  width: 100%;
  transition: all 0.2s ease;
}

.settings-select:focus,
.settings-input:focus {
  border-color: #67e8f9;
  background: rgba(0, 0, 0, calc(0.4 * var(--panel-opacity-factor)));
  outline: none;
}

.settings-info-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background: rgba(255, 255, 255, calc(0.02 * var(--panel-opacity-factor)));
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, calc(0.1 * var(--panel-opacity-factor)));
}

.settings-field__hint-inline {
  font-size: 11px;
  color: #9ca3af;
}

.value-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(103, 232, 249, 0.1);
  color: #67e8f9;
  border-radius: 99px;
  font-weight: 500;
}

.btn-primary {
  padding: 8px 16px;
  background: rgba(103, 232, 249, 0.15);
  border: 1px solid rgba(103, 232, 249, 0.4);
  color: #67e8f9;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: rgba(103, 232, 249, 0.25);
  transform: translateY(-1px);
}
</style>
