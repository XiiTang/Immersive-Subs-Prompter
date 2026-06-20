<template>
  <UiSection :title="t('feature-jellyfin-emby-title')">
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
            v-for="(server, index) in visibleServers"
            :key="server.id"
            as="div"
            density="compact"
            class="profile-list__item"
            :highlighted="dragOverIndex === index"
            :selected="server.id === selectedServerId"
            :draggable="true"
            :data-testid="`feature-jellyfin-emby-server-${server.id}`"
            @click="selectedServerId = server.id"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent="dragOverIndex = index"
            @dragleave="dragOverIndex = null"
            @drop.prevent="onDrop(index)"
            @dragend="resetDrag"
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
                @dragstart.stop
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
                @dragstart.stop
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
              @dragstart.stop
            >
              <IconCheck v-if="server.enabled" size="sm" />
            </button>
          </UiListItem>
        </div>
        <UiEmptyState v-else :message="t('feature-jellyfin-emby-empty')" />
      </aside>

      <section v-if="editableServer" class="settings-split__editor">
        <UiSettingRow
          id="feature-jellyfin-emby-server-url-row"
          :label="t('feature-jellyfin-emby-server-url')"
          :hint="t('feature-jellyfin-emby-server-url-hint')"
          :error="serverUrlsError(editableServer)"
          control-width="wide"
        >
          <UiInput
            id="feature-jellyfin-emby-server-url"
            :model-value="editableServer.serverUrls"
            @update:model-value="updateSelectedServer({ serverUrls: String($event) })"
          />
        </UiSettingRow>
        <UiSettingRow
          id="feature-jellyfin-emby-api-key-row"
          :label="t('feature-jellyfin-emby-api-key')"
          :error="serverApiKeyError(editableServer)"
          control-width="wide"
        >
          <div class="ui-input-action">
            <UiInput
              id="feature-jellyfin-emby-api-key"
              class="ui-input-action__input"
              :model-value="editableServer.apiKey"
              :type="apiKeyVisible ? 'text' : 'password'"
              @update:model-value="updateSelectedServer({ apiKey: String($event) })"
            />
            <UiIconButton
              class="ui-input-action__button"
              data-testid="feature-jellyfin-emby-api-key-visibility"
              size="sm"
              :label="apiKeyVisible ? t('feature-jellyfin-emby-api-key-hide') : t('feature-jellyfin-emby-api-key-show')"
              @click="apiKeyVisible = !apiKeyVisible"
            >
              <IconEyeOff v-if="apiKeyVisible" size="sm" />
              <IconEye v-else size="sm" />
            </UiIconButton>
          </div>
        </UiSettingRow>
      </section>
      <section v-else class="settings-split__editor">
        <UiEmptyState :message="t('feature-jellyfin-emby-empty')" />
      </section>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { isValidJellyfinEmbyServerUrls, parseJellyfinEmbyServerUrls } from "../../../common/jellyfinEmbyServerUrls";
import type { JellyfinEmbyServerConfig } from "../../../main/types";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { IconAdd, IconCheck, IconCopy, IconDelete, IconEye, IconEyeOff } from "../icons";
import { UiButton, UiEmptyState, UiIconButton, UiInput, UiListItem, UiSection, UiSettingRow, UiToolbar } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const selectedServerId = ref<string | null>(null);
const serverDrafts = ref<Record<string, JellyfinEmbyServerConfig>>({});
const draftServerIds = ref<Set<string>>(new Set());
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const editingServerId = ref<string | null>(null);
const draftServerName = ref("");
const apiKeyVisible = ref(false);
const servers = computed(() => store.settings?.features.jellyfinEmby.config.servers ?? []);
const visibleServers = computed(() => {
  const persisted = servers.value.map((server) => serverDrafts.value[server.id] ?? server);
  const persistedIds = new Set(persisted.map((server) => server.id));
  const drafts = Object.values(serverDrafts.value).filter((server) => !persistedIds.has(server.id));
  return [...persisted, ...drafts];
});
const selectedServer = computed(() =>
  visibleServers.value.find((server) => server.id === selectedServerId.value) ?? visibleServers.value[0] ?? null
);
const editableServer = computed(() => selectedServer.value);

watch(
  visibleServers,
  (nextServers) => {
    if (!nextServers.some((server) => server.id === selectedServerId.value)) {
      selectedServerId.value = nextServers[0]?.id ?? null;
    }
  },
  { immediate: true, deep: true }
);

function createServerDraftId(): string {
  return `jellyfin-emby-${crypto.randomUUID()}`;
}

function addServer() {
  const id = createServerDraftId();
  const draft: JellyfinEmbyServerConfig = {
    id,
    name: `Server ${visibleServers.value.length + 1}`,
    serverUrls: "",
    apiKey: "",
    enabled: true
  };
  draftServerIds.value = new Set([...draftServerIds.value, id]);
  serverDrafts.value = {
    ...serverDrafts.value,
    [id]: draft
  };
  selectedServerId.value = id;
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
    if (draftServerIds.value.has(nextServer.id)) {
      draftServerIds.value = new Set([...draftServerIds.value].filter((id) => id !== nextServer.id));
    }
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
  if (!draftServerIds.value.has(id)) {
    await store.deleteJellyfinEmbyServer(id);
  }
  const { [id]: _removed, ...remainingDrafts } = serverDrafts.value;
  draftServerIds.value = new Set([...draftServerIds.value].filter((draftId) => draftId !== id));
  serverDrafts.value = remainingDrafts;
  selectedServerId.value = visibleServers.value.find((server) => server.id !== id)?.id ?? null;
}

function serverMeta(server: JellyfinEmbyServerConfig): string {
  if (!server.serverUrls.trim()) {
    return t("feature-jellyfin-emby-no-url");
  }
  if (!isValidJellyfinEmbyServerUrls(server.serverUrls)) {
    return server.serverUrls.trim();
  }
  const urls = parseJellyfinEmbyServerUrls(server.serverUrls);
  if (!urls.length) {
    return t("feature-jellyfin-emby-no-url");
  }
  if (urls.length === 1) {
    return urls[0]!.baseUrl;
  }
  return t("feature-jellyfin-emby-url-count", { count: urls.length });
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

function serverUrlsError(server: JellyfinEmbyServerConfig): string | null {
  if (!server.serverUrls.trim()) {
    return null;
  }
  if (!isValidJellyfinEmbyServerUrls(server.serverUrls)) {
    return t("feature-jellyfin-emby-url-http");
  }
  return null;
}

function serverApiKeyError(server: JellyfinEmbyServerConfig): string | null {
  if (!server.enabled || server.apiKey.trim()) {
    return null;
  }
  return t("feature-jellyfin-emby-api-key-required");
}

function canPersistServerDraft(server: JellyfinEmbyServerConfig): boolean {
  if (server.serverUrls.trim() && !isValidJellyfinEmbyServerUrls(server.serverUrls)) {
    return false;
  }
  if (!server.enabled) {
    return true;
  }
  return Boolean(server.serverUrls.trim() && server.apiKey.trim());
}

function onDragStart(event: DragEvent, index: number) {
  dragIndex.value = index;
  dragOverIndex.value = index;
  event.dataTransfer?.setData("text/plain", String(index));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDrop(index: number) {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    void store.reorderJellyfinEmbyServer(dragIndex.value, index);
  }
  resetDrag();
}

function resetDrag() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}
</script>

<style scoped>
@media (max-width: 760px) {
  .jellyfin-emby-settings {
    grid-template-columns: 1fr;
  }
}
</style>
