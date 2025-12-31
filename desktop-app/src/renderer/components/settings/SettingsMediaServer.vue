<template>
  <section class="settings-section">
    <h3 class="settings-section__title">
      {{ t("section-mediaserver", "Media Server Integration") }}
      <label class="toggle toggle--sm settings-section__toggle">
        <input type="checkbox" v-model="mediaServerEnabled" />
        <span class="toggle__text">{{ t("mediaserver-enable-label", "Enable Media Server") }}</span>
      </label>
    </h3>

    <div class="mediaserver-config-manager" v-if="mediaServerEnabled">
      <div class="mediaserver-config-manager__sidebar">
        <div class="mediaserver-config-manager__actions">
          <span class="settings-field__label">{{ t("server-list-label", "Server List") }}</span>
          <div class="mediaserver-config-manager__buttons">
            <button
              type="button"
              class="icon-button"
              :title="t('button-add', 'Add')"
              :aria-label="t('button-add', 'Add')"
              @click="addMediaServerConfig"
            >
              <IconAdd size="md" />
            </button>
            <button
              type="button"
              class="icon-button"
              :disabled="!selectedMediaServerConfigId"
              :title="t('button-delete', 'Delete')"
              :aria-label="t('button-delete', 'Delete')"
              @click="deleteSelectedMediaServerConfig"
            >
              <IconDelete size="md" />
            </button>
          </div>
        </div>
        <div class="mediaserver-config-list" :class="{ 'mediaserver-config-list--empty': !mediaServerConfigs.length }">
          <template v-if="mediaServerConfigs.length">
            <button
              v-for="config in mediaServerConfigs"
              :key="config.id"
              type="button"
              class="mediaserver-config-list__item"
              :class="{
                'is-selected': config.id === selectedMediaServerConfigId,
                'is-disabled': !config.enabled
              }"
              @click="selectedMediaServerConfigId = config.id"
            >
              <div class="mediaserver-config-list__name">
                {{ config.name || config.serverUrl || t("mediaserver-untitled", "Untitled") }}
              </div>
              <div class="mediaserver-config-list__toggle">
                <span>{{ config.enabled ? t("mediaserver-config-enabled", "Enabled") : t("mediaserver-config-disabled", "Disabled") }}</span>
              </div>
            </button>
          </template>
          <div v-else class="mediaserver-config-list__empty">
            {{ t("mediaserver-no-servers", "No servers configured") }}
          </div>
        </div>
      </div>
      <div class="mediaserver-config-manager__editor" v-if="selectedMediaServerConfig">
        <label class="settings-field">
          <span class="settings-field__label">{{ t("server-name-label", "Server Name") }}</span>
          <input type="text" v-model="mediaServerName" />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("server-url-label", "Server URL") }}</span>
          <input type="text" v-model="mediaServerServerUrl" />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("api-key-label", "API Key") }}</span>
          <input type="text" v-model="mediaServerApiKey" />
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("ws-path-label", "WebSocket Path") }}</span>
          <input type="text" v-model="mediaServerWsPath" />
        </label>
        <div class="settings-field settings-field--inline">
          <span class="settings-field__label">{{ t("mediaserver-config-enable-label", "Enable This Server") }}</span>
          <label class="toggle">
            <input type="checkbox" v-model="mediaServerConfigEnabled" />
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
import { IconAdd, IconDelete } from "../icons";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const mediaServerEnabled = computed({
  get: () => store.settings?.mediaServer.enabled ?? false,
  set: (value: boolean) => store.setMediaServerEnabled(value)
});

const mediaServerConfigs = computed(() => store.settings?.mediaServer.configs ?? []);
const selectedMediaServerConfigId = ref<string | null>(null);

const selectedMediaServerConfig = computed(() =>
  mediaServerConfigs.value.find((c) => c.id === selectedMediaServerConfigId.value)
);

const mediaServerName = computed({
  get: () => selectedMediaServerConfig.value?.name ?? "",
  set: (value: string) => {
    if (selectedMediaServerConfigId.value) {
      store.updateMediaServerConfig(selectedMediaServerConfigId.value, { name: value });
    }
  }
});

const mediaServerServerUrl = computed({
  get: () => selectedMediaServerConfig.value?.serverUrl ?? "",
  set: (value: string) => {
    if (selectedMediaServerConfigId.value) {
      store.updateMediaServerConfig(selectedMediaServerConfigId.value, { serverUrl: value });
    }
  }
});

const mediaServerApiKey = computed({
  get: () => selectedMediaServerConfig.value?.apiKey ?? "",
  set: (value: string) => {
    if (selectedMediaServerConfigId.value) {
      store.updateMediaServerConfig(selectedMediaServerConfigId.value, { apiKey: value });
    }
  }
});

const mediaServerWsPath = computed({
  get: () => selectedMediaServerConfig.value?.webSocketPath ?? "",
  set: (value: string) => {
    if (selectedMediaServerConfigId.value) {
      store.updateMediaServerConfig(selectedMediaServerConfigId.value, { webSocketPath: value });
    }
  }
});

const mediaServerConfigEnabled = computed({
  get: () => selectedMediaServerConfig.value?.enabled ?? true,
  set: (value: boolean) => {
    if (selectedMediaServerConfigId.value) {
      store.updateMediaServerConfig(selectedMediaServerConfigId.value, { enabled: value });
    }
  }
});

function addMediaServerConfig() {
  const id = store.addMediaServerConfig();
  if (id) {
    selectedMediaServerConfigId.value = id;
  }
}

function deleteSelectedMediaServerConfig() {
  if (selectedMediaServerConfigId.value) {
    store.deleteMediaServerConfig(selectedMediaServerConfigId.value);
    selectedMediaServerConfigId.value = null;
  }
}

watch(
  mediaServerConfigs,
  (configs) => {
    if (configs.length > 0 && !selectedMediaServerConfigId.value) {
      selectedMediaServerConfigId.value = configs[0].id;
    }
  },
  { immediate: true }
);
</script>
