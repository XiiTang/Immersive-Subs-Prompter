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
              as="div"
              class="mediaserver-config-list__item"
              :selected="config.id === selectedMediaServerConfigId"
              :disabled="!config.enabled"
              @click="selectedMediaServerConfigId = config.id"
            >
              <div class="mediaserver-config-list__content">
                <UiInput
                  v-if="editingMediaServerNameConfigId === config.id"
                  class="settings-config-name-input mediaserver-config-list__name-input"
                  data-testid="mediaserver-config-name-input"
                  :data-config-id="config.id"
                  v-model="draftMediaServerName"
                  :aria-label="t('server-name-label', 'Server Name')"
                  @click.stop
                  @mousedown.stop
                  @dragstart.stop
                  @keydown.enter.prevent.stop="($event.target as HTMLInputElement).blur()"
                  @keydown.escape.prevent.stop="cancelMediaServerNameEdit"
                  @blur="commitMediaServerName(config.id)"
                />
                <UiButton
                  v-else
                  variant="ghost"
                  size="sm"
                  class="settings-config-name-action mediaserver-config-list__name-action"
                  data-testid="mediaserver-config-name-action"
                  @click.stop="startMediaServerNameEdit(config)"
                  @mousedown.stop
                  @dragstart.stop
                >
                  {{ getMediaServerName(config) }}
                </UiButton>
              </div>
              <UiCheckIndicator
                class="settings-config-state-indicator"
                :checked="config.enabled"
                :label="getMediaServerStateLabel(config)"
                tone="success"
                test-id="mediaserver-config-state"
                @click.stop
                @update:checked="(enabled) => setMediaServerEnabled(config.id, enabled)"
              />
            </UiListItem>
          </template>
          <UiEmptyState v-else :message="t('mediaserver-no-servers', 'No servers configured')" />
        </div>
      </div>
      <div class="settings-split__editor" v-if="selectedMediaServerConfig">
        <UiField id="server-url" :label="t('server-url-label', 'Server URL')">
          <UiInput v-model="mediaServerServerUrl" />
        </UiField>
        <UiField id="server-api-key" :label="t('api-key-label', 'API Key')">
          <UiInput v-model="mediaServerApiKey" />
        </UiField>
        <UiField id="server-ws-path" :label="t('ws-path-label', 'WebSocket Path')">
          <UiInput v-model="mediaServerWsPath" />
        </UiField>
      </div>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { JellyfinembyServerConfig } from "../../../main/types";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { IconAdd, IconDelete } from "../icons";
import { UiButton, UiCheckIndicator, UiEmptyState, UiField, UiIconButton, UiInput, UiListItem, UiSection } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const mediaServerConfigs = computed(() => store.getJellyfinembyPluginConfig().servers);
const selectedMediaServerConfigId = ref<string | null>(null);
const editingMediaServerNameConfigId = ref<string | null>(null);
const draftMediaServerName = ref("");

const selectedMediaServerConfig = computed(() =>
  mediaServerConfigs.value.find((c) => c.id === selectedMediaServerConfigId.value)
);

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

function getMediaServerName(config: JellyfinembyServerConfig) {
  return config.name || config.serverUrl || t("mediaserver-untitled", "Untitled");
}

function getMediaServerStateLabel(config: JellyfinembyServerConfig) {
  return config.enabled
    ? t("mediaserver-config-enabled", "Enabled")
    : t("mediaserver-config-disabled", "Disabled");
}

function setMediaServerEnabled(configId: string, enabled: boolean) {
  selectedMediaServerConfigId.value = configId;
  store.updateMediaServerConfig(configId, { enabled });
}

async function startMediaServerNameEdit(config: JellyfinembyServerConfig) {
  selectedMediaServerConfigId.value = config.id;
  editingMediaServerNameConfigId.value = config.id;
  draftMediaServerName.value = getMediaServerName(config);
  await nextTick();
  const input = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid="mediaserver-config-name-input"]')).find(
    (element) => element.dataset.configId === config.id
  );
  input?.focus();
  input?.select();
}

function cancelMediaServerNameEdit() {
  editingMediaServerNameConfigId.value = null;
  draftMediaServerName.value = "";
}

function commitMediaServerName(configId: string) {
  const name = draftMediaServerName.value.trim();
  editingMediaServerNameConfigId.value = null;
  draftMediaServerName.value = "";
  if (!name.length) {
    return;
  }
  store.updateMediaServerConfig(configId, { name });
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
