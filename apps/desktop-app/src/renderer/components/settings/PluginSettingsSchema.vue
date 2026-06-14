<template>
  <UiSection v-if="section && plugin" :title="section.title">
    <div class="schema-fields">
      <UiSettingRow
        v-for="field in section.schema"
        :id="`${plugin.pluginKey}-${field.id}`"
        :key="field.id"
        :label="field.label"
        control-width="editor"
        stacked
      >
        <UiSwitch
          v-if="field.type === 'boolean'"
          :label="field.label"
          :model-value="Boolean(config[field.id])"
          :show-label="false"
          @update:model-value="updateField(field.id, $event)"
        />
        <UiSelect
          v-else-if="field.type === 'select'"
          :model-value="String(config[field.id] ?? '')"
          :options="field.options ?? []"
          @update:model-value="updateField(field.id, $event)"
        />
        <UiTextarea
          v-else-if="field.type === 'textarea'"
          :model-value="stringValue(field.id)"
          :rows="4"
          @update:model-value="updateField(field.id, $event)"
        />
        <div v-else-if="field.type === 'serverList'" class="plugin-server-list">
          <div
            v-for="server in serverList(field.id)"
            :key="server.id"
            class="plugin-server-list__row"
          >
            <UiInput
              :model-value="server.name"
              placeholder="Name"
              @update:model-value="updateServer(field.id, server.id, { name: String($event) })"
            />
            <UiInput
              :model-value="server.serverUrl"
              placeholder="Server URL"
              @update:model-value="updateServer(field.id, server.id, { serverUrl: String($event) })"
            />
            <UiInput
              :model-value="server.apiKey"
              placeholder="API key"
              @update:model-value="updateServer(field.id, server.id, { apiKey: String($event) })"
            />
            <UiSwitch
              label="Enabled"
              :model-value="server.enabled"
              @update:model-value="updateServer(field.id, server.id, { enabled: $event })"
            />
            <UiIconButton
              label="Delete server"
              variant="danger"
              size="sm"
              @click="removeServer(field.id, server.id)"
            >
              <IconDelete size="sm" />
            </UiIconButton>
          </div>
          <UiButton
            size="sm"
            class="plugin-server-list__add"
            :data-testid="`plugin-server-list-add-${field.id}`"
            @click="addServer(field.id)"
          >
            <IconAdd size="sm" />
            Add server
          </UiButton>
        </div>
        <UiInput
          v-else
          :model-value="inputValue(field.id)"
          :type="field.type === 'number' ? 'number' : 'text'"
          @update:model-value="updateField(field.id, $event)"
        />
      </UiSettingRow>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IconAdd, IconDelete } from "../icons";
import { useDesktopStore } from "../../stores/desktop";
import { UiButton, UiIconButton, UiInput, UiSection, UiSelect, UiSettingRow, UiSwitch, UiTextarea } from "../ui";
import { decodePluginSettingsSectionKey } from "./pluginSettingsSectionKey";

interface PluginServerConfig {
  id: string;
  name: string;
  serverUrl: string;
  apiKey: string;
  enabled: boolean;
}

const props = defineProps<{ sectionId: string }>();
const store = useDesktopStore();

const sectionKey = computed(() => decodePluginSettingsSectionKey(props.sectionId));
const plugin = computed(() =>
  sectionKey.value
    ? store.pluginCatalog.find((candidate) => candidate.pluginKey === sectionKey.value?.pluginKey) ?? null
    : null
);
const section = computed(() =>
  plugin.value?.settings?.find((candidate) => candidate.id === sectionKey.value?.sectionId) ?? null
);
const config = computed(() => {
  const pluginKey = plugin.value?.pluginKey;
  return pluginKey ? store.settings?.plugins[pluginKey]?.config ?? {} : {};
});

function inputValue(fieldId: string): string | number {
  const value = config.value[fieldId];
  if (typeof value === "number") {
    return value;
  }
  return typeof value === "string" ? value : "";
}

function stringValue(fieldId: string): string {
  const value = config.value[fieldId];
  return typeof value === "string" ? value : "";
}

function serverList(fieldId: string): PluginServerConfig[] {
  const value = config.value[fieldId];
  return Array.isArray(value) ? (value as PluginServerConfig[]) : [];
}

function createServerRecord(): PluginServerConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    serverUrl: "",
    apiKey: "",
    enabled: true
  };
}

function addServer(fieldId: string) {
  updateField(fieldId, [...serverList(fieldId), createServerRecord()]);
}

function updateServer(fieldId: string, serverId: string, patch: Partial<PluginServerConfig>) {
  updateField(
    fieldId,
    serverList(fieldId).map((server) =>
      server.id === serverId
        ? {
            ...server,
            ...patch
          }
        : server
    )
  );
}

function removeServer(fieldId: string, serverId: string) {
  updateField(fieldId, serverList(fieldId).filter((server) => server.id !== serverId));
}

function updateField(fieldId: string, value: unknown) {
  const pluginKey = plugin.value?.pluginKey;
  if (!pluginKey) {
    return;
  }
  store.setPluginConfig(pluginKey, {
    ...config.value,
    [fieldId]: value
  });
}
</script>

<style scoped>
.schema-fields {
  display: grid;
  gap: 12px;
}

.plugin-server-list {
  display: grid;
  gap: 10px;
}

.plugin-server-list__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 8px;
  align-items: center;
  padding-block: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 70%, transparent);
}

.plugin-server-list__add {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 760px) {
  .plugin-server-list__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
