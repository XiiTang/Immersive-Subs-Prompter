<template>
  <section class="settings-section">
    <h3 class="settings-section__title">{{ t("section-jellyfin", "Jellyfin Integration") }}</h3>
    <div class="settings-field settings-field--inline">
      <span class="settings-field__label">{{ t("jellyfin-enable-label", "Enable Jellyfin") }}</span>
      <label class="toggle">
        <input type="checkbox" v-model="jellyfinEnabled" />
        <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
      </label>
    </div>

    <div class="jellyfin-config-manager">
      <div class="jellyfin-config-manager__sidebar">
        <div class="jellyfin-config-manager__actions">
          <span class="settings-field__label">{{ t("server-list-label", "Server List") }}</span>
          <div class="jellyfin-config-manager__buttons">
            <button type="button" class="text-button" @click="addJellyfinConfig">
              {{ t("button-add", "Add") }}
            </button>
            <button
              type="button"
              class="text-button"
              :disabled="!selectedJellyfinConfigId"
              @click="deleteSelectedJellyfinConfig"
            >
              {{ t("button-delete", "Delete") }}
            </button>
          </div>
        </div>
        <div class="jellyfin-config-list" :class="{ 'jellyfin-config-list--empty': !jellyfinConfigs.length }">
          <template v-if="jellyfinConfigs.length">
            <button
              v-for="config in jellyfinConfigs"
              :key="config.id"
              type="button"
              class="jellyfin-config-list__item"
              :class="{
                'is-selected': config.id === selectedJellyfinConfigId,
                'is-disabled': !config.enabled
              }"
              @click="selectedJellyfinConfigId = config.id"
            >
              <div class="jellyfin-config-list__name">{{ config.name || config.serverUrl || "Untitled" }}</div>
              <div class="jellyfin-config-list__toggle">
                <span>{{ config.enabled ? t("jellyfin-config-enabled", "Enabled") : t("jellyfin-config-disabled", "Disabled") }}</span>
              </div>
            </button>
          </template>
          <div v-else class="jellyfin-config-list__empty">
            {{ t("jellyfin-no-servers", "No servers configured") }}
          </div>
        </div>
      </div>
      <div class="jellyfin-config-manager__editor" v-if="selectedJellyfinConfig">
        <label class="settings-field">
          <span class="settings-field__label">{{ t("server-name-label", "Server Name") }}</span>
          <input type="text" v-model="jellyfinName" />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("server-url-label", "Server URL") }}</span>
          <input type="text" v-model="jellyfinServerUrl" />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("api-key-label", "API Key") }}</span>
          <input type="text" v-model="jellyfinApiKey" />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("ws-path-label", "WebSocket Path") }}</span>
          <input type="text" v-model="jellyfinWsPath" />
        </label>
        <div class="settings-field settings-field--inline">
          <span class="settings-field__label">{{ t("jellyfin-enable-label", "Enable Jellyfin") }}</span>
          <label class="toggle">
            <input type="checkbox" v-model="jellyfinConfigEnabled" />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import type { JellyfinConfig } from "../../main/types";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const jellyfinEnabled = computed({
  get: () => store.settings?.jellyfin.enabled ?? false,
  set: (value: boolean) => store.setJellyfinEnabled(value)
});

const jellyfinConfigs = computed(() => store.settings?.jellyfin.configs ?? []);
const selectedJellyfinConfigId = ref<string | null>(null);

const selectedJellyfinConfig = computed(() =>
  jellyfinConfigs.value.find((c) => c.id === selectedJellyfinConfigId.value)
);

const jellyfinName = computed({
  get: () => selectedJellyfinConfig.value?.name ?? "",
  set: (value: string) => {
    if (selectedJellyfinConfigId.value) {
      store.updateJellyfinConfig(selectedJellyfinConfigId.value, { name: value });
    }
  }
});

const jellyfinServerUrl = computed({
  get: () => selectedJellyfinConfig.value?.serverUrl ?? "",
  set: (value: string) => {
    if (selectedJellyfinConfigId.value) {
      store.updateJellyfinConfig(selectedJellyfinConfigId.value, { serverUrl: value });
    }
  }
});

const jellyfinApiKey = computed({
  get: () => selectedJellyfinConfig.value?.apiKey ?? "",
  set: (value: string) => {
    if (selectedJellyfinConfigId.value) {
      store.updateJellyfinConfig(selectedJellyfinConfigId.value, { apiKey: value });
    }
  }
});

const jellyfinWsPath = computed({
  get: () => selectedJellyfinConfig.value?.webSocketPath ?? "",
  set: (value: string) => {
    if (selectedJellyfinConfigId.value) {
      store.updateJellyfinConfig(selectedJellyfinConfigId.value, { webSocketPath: value });
    }
  }
});

const jellyfinConfigEnabled = computed({
  get: () => selectedJellyfinConfig.value?.enabled ?? true,
  set: (value: boolean) => {
    if (selectedJellyfinConfigId.value) {
      store.updateJellyfinConfig(selectedJellyfinConfigId.value, { enabled: value });
    }
  }
});

function addJellyfinConfig() {
  const id = store.addJellyfinConfig();
  if (id) {
    selectedJellyfinConfigId.value = id;
  }
}

function deleteSelectedJellyfinConfig() {
  if (selectedJellyfinConfigId.value) {
    store.deleteJellyfinConfig(selectedJellyfinConfigId.value);
    selectedJellyfinConfigId.value = null;
  }
}

watch(
  jellyfinConfigs,
  (configs) => {
    if (configs.length > 0 && !selectedJellyfinConfigId.value) {
      selectedJellyfinConfigId.value = configs[0].id;
    }
  },
  { immediate: true }
);
</script>
