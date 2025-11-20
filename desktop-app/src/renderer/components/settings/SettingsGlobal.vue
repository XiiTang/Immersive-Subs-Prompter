<template>
  <section class="settings-section">
    <h3 class="settings-section__title">{{ t("section-global-settings", "Global Settings") }}</h3>
    <label class="settings-field">
      <span class="settings-field__label">{{ t("close-behavior-label", "Close Behavior") }}</span>
      <select v-model="closeBehavior">
        <option value="tray">{{ t("close-behavior-tray", "Minimize to tray on close") }}</option>
        <option value="quit">{{ t("close-behavior-quit", "Quit application") }}</option>
      </select>
    </label>
    <div class="settings-field settings-field--inline">
      <span class="settings-field__label">{{ t("auto-start-label", "Auto Start") }}</span>
      <label class="toggle">
        <input type="checkbox" v-model="autoLaunch" />
        <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
      </label>
    </div>
    <div class="settings-field settings-field--inline">
      <span class="settings-field__label">Auto-hide Panels</span>
      <label class="toggle">
        <input type="checkbox" v-model="autoHidePanels" />
        <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
      </label>
    </div>
    <label class="settings-field">
      <span class="settings-field__label">{{ t("toggle-shortcut-label", "Toggle Window Shortcut") }}</span>
      <input type="text" v-model="toggleShortcut" placeholder="CommandOrControl+Shift+S" />
      <span class="settings-field__hint">{{ t("toggle-shortcut-hint", "Use modifiers with keys.") }}</span>
    </label>
    <section class="settings-field">
      <div class="settings-field__label-row">
        <span class="settings-field__label">{{ t("process-blacklist-label", "Process Blacklist") }}</span>
        <small class="settings-field__hint">
          {{ t("process-blacklist-hint", "Disable shortcuts when these processes are foregrounded.") }}
        </small>
      </div>
      <div class="game-blacklist-editor__controls">
        <input
          type="text"
          v-model="gameProcessInput"
          :placeholder="t('primary-priority-placeholder', 'e.g.: cyberpunk2077.exe')"
          autocomplete="off"
          @keyup.enter="addGameProcess"
        />
        <button type="button" class="text-button" @click="addGameProcess">
          {{ t("button-add", "Add") }}
        </button>
      </div>
      <div class="game-blacklist-editor__list">
        <template v-if="gameProcesses.length">
          <div
            v-for="process in gameProcesses"
            :key="process"
            class="game-blacklist-editor__item"
          >
            <span>{{ process }}</span>
            <button
              type="button"
              class="game-blacklist-editor__item-remove"
              :aria-label="t('game-blacklist-remove', 'Remove')"
              @click="removeGameProcess(process)"
            >
              ✕
            </button>
          </div>
        </template>
        <div v-else class="game-blacklist-editor__empty">
          {{ t("game-blacklist-none", "No processes yet.") }}
        </div>
      </div>
    </section>
    <label class="settings-field">
      <div class="settings-field__label-row">
        <span class="settings-field__label">{{ t("auto-hide-label", "Auto-hide Trigger Area Height") }}</span>
        <span class="settings-field__value">{{ autoHideHeight }}px</span>
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
      <small class="settings-field__hint">
        {{ t("auto-hide-hint", "Distance from top that keeps panels expanded while auto-hide is on") }}
      </small>
    </label>
    <label class="settings-field">
      <span class="settings-field__label">{{ t("language-label", "Language") }}</span>
      <select v-model="languageSetting">
        <option value="en">{{ t("language-option-en", "English") }}</option>
        <option value="zh">{{ t("language-option-zh", "中文") }}</option>
      </select>
      <small class="settings-field__hint">{{ t("language-hint", "Select interface language.") }}</small>
    </label>
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
