<template>
  <UiSection :title="t('section-mediaserver', 'Jellyfin / Emby')">
    <div class="settings-split">
      <div class="settings-split__sidebar">
        <div class="settings-split__sidebar-header">
          <span class="ui-field__label">{{ t("server-list-label", "Server List") }}</span>
          <div class="settings-split__sidebar-buttons">
            <UiIconButton :label="t('button-add', 'Add')" @click="addMediaServerConfig">
              <IconAdd size="md" />
            </UiIconButton>
            <UiIconButton
              :disabled="!selectedMediaServerConfigId"
              variant="danger"
              :label="t('button-delete', 'Delete')"
              @click="deleteSelectedMediaServerConfig"
            >
              <IconDelete size="md" />
            </UiIconButton>
          </div>
        </div>
        <div class="mediaserver-config-list ui-list" :class="{ 'mediaserver-config-list--empty': !mediaServerConfigs.length }">
          <template v-if="mediaServerConfigs.length">
            <UiListItem
              v-for="config in mediaServerConfigs"
              :key="config.id"
              as="button"
              class="mediaserver-config-list__item"
              :selected="config.id === selectedMediaServerConfigId"
              :disabled="!config.enabled"
              @click="selectedMediaServerConfigId = config.id"
            >
              <div class="mediaserver-config-list__name">
                {{ config.name || config.serverUrl || t("mediaserver-untitled", "Untitled") }}
              </div>
              <UiBadge :tone="config.enabled ? 'success' : 'neutral'">
                {{ config.enabled ? t("mediaserver-config-enabled", "Enabled") : t("mediaserver-config-disabled", "Disabled") }}
              </UiBadge>
            </UiListItem>
          </template>
          <UiEmptyState v-else :message="t('mediaserver-no-servers', 'No servers configured')" />
        </div>
      </div>
      <div class="settings-split__editor" v-if="selectedMediaServerConfig">
        <UiField id="server-name" :label="t('server-name-label', 'Server Name')">
          <UiInput v-model="mediaServerName" />
        </UiField>
        <UiField id="server-url" :label="t('server-url-label', 'Server URL')">
          <UiInput v-model="mediaServerServerUrl" />
        </UiField>
        <UiField id="server-api-key" :label="t('api-key-label', 'API Key')">
          <UiInput v-model="mediaServerApiKey" />
        </UiField>
        <UiField id="server-ws-path" :label="t('ws-path-label', 'WebSocket Path')">
          <UiInput v-model="mediaServerWsPath" />
        </UiField>
        <UiField id="server-enabled" :label="t('mediaserver-config-state-label', 'Server')" inline>
          <UiSwitch v-model="mediaServerConfigEnabled" :label="mediaServerConfigEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
        </UiField>
      </div>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { IconAdd, IconDelete } from "../icons";
import { UiBadge, UiEmptyState, UiField, UiIconButton, UiInput, UiListItem, UiSection, UiSwitch } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const mediaServerConfigs = computed(() => store.getJellyfinembyPluginConfig().servers);
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
    if (selectedMediaServerConfigId.value && configs.some((config) => config.id === selectedMediaServerConfigId.value)) {
      return;
    }
    selectedMediaServerConfigId.value = configs[0]?.id ?? null;
  },
  { immediate: true }
);
</script>
