<template>
  <div class="feature-settings">
    <div v-if="servers.length" class="server-list">
      <div v-for="server in servers" :key="server.id" class="server-card">
        <div class="server-row">
          <UiInput
            :model-value="server.name"
            :placeholder="t('feature-jellyfin-emby-server-name')"
            @update:model-value="updateServer(server.id, { name: String($event) })"
          />
          <UiInput
            :model-value="server.serverUrl"
            :placeholder="t('feature-jellyfin-emby-server-url')"
            @update:model-value="updateServer(server.id, { serverUrl: String($event) })"
          />
          <UiInput
            :model-value="server.apiKey"
            :placeholder="t('feature-jellyfin-emby-api-key')"
            @update:model-value="updateServer(server.id, { apiKey: String($event) })"
          />
          <UiSwitch
            :model-value="server.enabled"
            :label="t('feature-jellyfin-emby-server-enabled')"
            @update:model-value="updateServer(server.id, { enabled: $event })"
          />
          <UiIconButton :label="t('feature-jellyfin-emby-delete-server')" variant="danger" size="sm" @click="removeServer(server.id)">
            <IconDelete size="sm" />
          </UiIconButton>
        </div>
        <div v-if="serverErrors(server).length" class="server-errors" role="status">
          <p v-for="error in serverErrors(server)" :key="error" class="server-errors__item">{{ error }}</p>
        </div>
      </div>
    </div>
    <UiEmptyState v-else :message="t('feature-jellyfin-emby-empty')" />
    <UiButton
      size="sm"
      class="server-add"
      data-testid="feature-jellyfin-emby-add-server"
      @click="addServer"
    >
      <IconAdd size="sm" />
      {{ t("button-add") }}
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { JellyfinEmbyServerConfig } from "../../../main/types";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { IconAdd, IconDelete } from "../icons";
import { UiButton, UiEmptyState, UiIconButton, UiInput, UiSwitch } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const servers = computed(() => store.settings?.features.jellyfinEmby.config.servers ?? []);

function createServerRecord(): JellyfinEmbyServerConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    serverUrl: "",
    apiKey: "",
    enabled: true
  };
}

function updateServers(nextServers: JellyfinEmbyServerConfig[]) {
  void store.setFeatureConfig("jellyfinEmby", { servers: nextServers });
}

function addServer() {
  updateServers([...servers.value, createServerRecord()]);
}

function updateServer(serverId: string, patch: Partial<JellyfinEmbyServerConfig>) {
  updateServers(servers.value.map((server) => server.id === serverId ? { ...server, ...patch } : server));
}

function removeServer(serverId: string) {
  updateServers(servers.value.filter((server) => server.id !== serverId));
}

function isHttpUrl(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }
  const parsed = new URL(value);
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

function serverErrors(server: JellyfinEmbyServerConfig): string[] {
  if (!server.enabled) {
    return [];
  }
  const errors: string[] = [];
  if (!server.name.trim()) {
    errors.push(t("feature-jellyfin-emby-name-required"));
  }
  if (!server.serverUrl.trim()) {
    errors.push(t("feature-jellyfin-emby-url-required"));
  } else if (!isHttpUrl(server.serverUrl)) {
    errors.push(t("feature-jellyfin-emby-url-http"));
  }
  if (!server.apiKey.trim()) {
    errors.push(t("feature-jellyfin-emby-api-key-required"));
  }
  return errors;
}
</script>

<style scoped>
.feature-settings,
.server-list,
.server-card {
  display: grid;
  gap: 10px;
}

.server-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
}

.server-add {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.server-errors {
  display: grid;
  gap: 4px;
  color: var(--ui-danger);
  font-size: 12px;
}

.server-errors__item {
  margin: 0;
}

@media (max-width: 900px) {
  .server-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
