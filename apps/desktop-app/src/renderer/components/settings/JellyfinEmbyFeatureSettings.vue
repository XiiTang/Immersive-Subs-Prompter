<template>
  <div class="settings-split jellyfin-emby-settings">
    <aside class="settings-split__sidebar profile-list-sidebar">
      <div class="settings-split__sidebar-header">
        <UiToolbar class="settings-split__sidebar-buttons" :label="t('feature-jellyfin-emby-server-list')" density="compact">
          <UiIconButton
            :label="t('button-add')"
            size="compact"
            data-testid="feature-jellyfin-emby-add-server"
            @click="addServer"
          >
            <IconAdd size="sm" />
          </UiIconButton>
          <UiIconButton
            :label="t('button-duplicate')"
            size="compact"
            data-testid="feature-jellyfin-emby-duplicate-server"
            :disabled="!selectedServerId"
            @click="duplicateSelectedServer"
          >
            <IconCopy size="sm" />
          </UiIconButton>
          <UiIconButton
            :label="t('button-delete')"
            size="compact"
            variant="danger"
            :disabled="!selectedServerId"
            @click="removeSelectedServer"
          >
            <IconDelete size="sm" />
          </UiIconButton>
        </UiToolbar>
      </div>
      <div v-if="visibleServers.length" class="profile-list">
        <UiListItem
          v-for="server in visibleServers"
          :key="server.id"
          as="div"
          density="compact"
          class="profile-list__item"
          :selected="server.id === selectedServerId"
          :data-testid="`feature-jellyfin-emby-server-${server.id}`"
          @click="selectedServerId = server.id"
        >
          <span class="profile-list__content">
            <UiInput
              v-if="editingServerId === server.id"
              class="profile-list__name-input"
              size="compact"
              data-testid="feature-jellyfin-emby-server-name"
              :data-server-id="server.id"
              v-model="draftServerName"
              :aria-label="t('feature-jellyfin-emby-server-name')"
              @click.stop
              @mousedown.stop
              @keydown="onServerNameInputKeydown"
              @blur="commitServerName(server.id)"
            />
            <UiButton
              v-else
              variant="editable"
              size="sm"
              block
              data-testid="feature-jellyfin-emby-server-name-action"
              @click.stop="startServerNameEdit(server)"
              @mousedown.stop
            >
              {{ server.name || t("feature-jellyfin-emby-untitled") }}
            </UiButton>
            <span class="profile-list__meta">{{ serverMeta(server) }}</span>
          </span>
          <button
            type="button"
            class="profile-list__status-action"
            :class="{ 'is-active': server.enabled }"
            :aria-label="t('feature-jellyfin-emby-server-enabled')"
            :aria-pressed="server.enabled ? 'true' : 'false'"
            :data-testid="`feature-jellyfin-emby-server-enabled-${server.id}`"
            @click.stop="updateServer(server.id, { enabled: !server.enabled })"
            @mousedown.stop
          >
            <IconCheck v-if="server.enabled" size="sm" />
          </button>
        </UiListItem>
      </div>
      <UiEmptyState v-else :message="t('feature-jellyfin-emby-empty')" />
    </aside>

    <section v-if="editableServer" class="settings-split__editor">
      <UiSettingRow id="feature-jellyfin-emby-server-url-row" :label="t('feature-jellyfin-emby-server-url')" control-width="wide">
        <UiInput
          id="feature-jellyfin-emby-server-url"
          :model-value="editableServer.serverUrl"
          @update:model-value="updateSelectedServer({ serverUrl: String($event) })"
        />
      </UiSettingRow>
      <UiSettingRow id="feature-jellyfin-emby-api-key-row" :label="t('feature-jellyfin-emby-api-key')" control-width="wide">
        <UiInput
          id="feature-jellyfin-emby-api-key"
          :model-value="editableServer.apiKey"
          type="password"
          @update:model-value="updateSelectedServer({ apiKey: String($event) })"
        />
      </UiSettingRow>
      <div v-if="serverErrors(editableServer).length" class="server-errors" role="status">
        <p v-for="error in serverErrors(editableServer)" :key="error" class="server-errors__item">{{ error }}</p>
      </div>
    </section>
    <section v-else class="settings-split__editor">
      <UiEmptyState :message="t('feature-jellyfin-emby-empty')" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { JellyfinEmbyServerConfig } from "../../../main/types";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { IconAdd, IconCheck, IconCopy, IconDelete } from "../icons";
import { UiButton, UiEmptyState, UiIconButton, UiInput, UiListItem, UiSettingRow, UiToolbar } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const selectedServerId = ref<string | null>(null);
const serverDrafts = ref<Record<string, JellyfinEmbyServerConfig>>({});
const editingServerId = ref<string | null>(null);
const draftServerName = ref("");
const servers = computed(() => store.settings?.features.jellyfinEmby.config.servers ?? []);
const visibleServers = computed(() =>
  servers.value.map((server) => serverDrafts.value[server.id] ?? server)
);
const selectedServer = computed(() =>
  visibleServers.value.find((server) => server.id === selectedServerId.value) ?? visibleServers.value[0] ?? null
);
const editableServer = computed(() => selectedServer.value);

watch(
  servers,
  (nextServers) => {
    if (!nextServers.some((server) => server.id === selectedServerId.value)) {
      selectedServerId.value = nextServers[0]?.id ?? null;
    }
  },
  { immediate: true, deep: true }
);

async function addServer() {
  selectedServerId.value = await store.addJellyfinEmbyServer();
}

async function duplicateSelectedServer() {
  const id = selectedServerId.value;
  if (!id) {
    return;
  }
  selectedServerId.value = await store.duplicateJellyfinEmbyServer(id);
}

function updateServer(serverId: string, patch: Partial<JellyfinEmbyServerConfig>) {
  const server = visibleServers.value.find((candidate) => candidate.id === serverId);
  if (!server) {
    return;
  }
  const nextServer = { ...server, ...patch };
  serverDrafts.value = {
    ...serverDrafts.value,
    [nextServer.id]: nextServer
  };
  if (canPersistServerDraft(nextServer)) {
    void store.updateJellyfinEmbyServer(nextServer.id, nextServer);
  }
}

function updateSelectedServer(patch: Partial<JellyfinEmbyServerConfig>) {
  const server = editableServer.value;
  if (server) {
    updateServer(server.id, patch);
  }
}

async function removeSelectedServer() {
  const id = selectedServerId.value;
  if (!id) {
    return;
  }
  await store.deleteJellyfinEmbyServer(id);
  const { [id]: _removed, ...remainingDrafts } = serverDrafts.value;
  serverDrafts.value = remainingDrafts;
  selectedServerId.value = servers.value.find((server) => server.id !== id)?.id ?? null;
}

function serverMeta(server: JellyfinEmbyServerConfig): string {
  return server.serverUrl || t("feature-jellyfin-emby-untitled");
}

async function startServerNameEdit(server: JellyfinEmbyServerConfig) {
  selectedServerId.value = server.id;
  editingServerId.value = server.id;
  draftServerName.value = server.name;
  await nextTick();
  const input = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid="feature-jellyfin-emby-server-name"]')).find(
    (element) => element.dataset.serverId === server.id
  );
  input?.focus();
  input?.select();
}

function cancelServerNameEdit() {
  editingServerId.value = null;
  draftServerName.value = "";
}

function onServerNameInputKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLInputElement).blur();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelServerNameEdit();
  }
}

function commitServerName(serverId: string) {
  const name = draftServerName.value.trim();
  const currentName = visibleServers.value.find((server) => server.id === serverId)?.name.trim() ?? "";
  editingServerId.value = null;
  draftServerName.value = "";
  if (!name.length || name === currentName) {
    return;
  }
  updateServer(serverId, { name });
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

function canPersistServerDraft(server: JellyfinEmbyServerConfig): boolean {
  return !server.serverUrl.trim() || isHttpUrl(server.serverUrl);
}
</script>

<style scoped>
.server-errors {
  display: grid;
  gap: 4px;
  color: var(--ui-danger);
  font-size: var(--ui-font-sm);
}

.server-errors__item {
  margin: 0;
}

@media (max-width: 760px) {
  .jellyfin-emby-settings {
    grid-template-columns: 1fr;
  }
}
</style>
