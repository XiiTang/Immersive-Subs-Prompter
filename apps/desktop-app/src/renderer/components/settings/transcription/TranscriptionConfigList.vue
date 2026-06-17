<template>
  <aside class="settings-split__sidebar profile-list-sidebar">
    <div class="settings-split__sidebar-header">
      <UiToolbar class="settings-split__sidebar-buttons" :label="t('feature-transcription-config-actions')" density="compact">
        <UiIconButton :label="t('button-add')" size="compact" data-testid="feature-transcription-add-config" @click="$emit('add')">
          <IconAdd size="sm" />
        </UiIconButton>
        <UiIconButton
          :label="t('button-duplicate')"
          size="compact"
          data-testid="feature-transcription-duplicate-config"
          @click="$emit('duplicate')"
        >
          <IconCopy size="sm" />
        </UiIconButton>
        <UiIconButton
          :label="t('button-delete')"
          size="compact"
          variant="danger"
          data-testid="feature-transcription-delete-config"
          @click="$emit('delete')"
        >
          <IconDelete size="sm" />
        </UiIconButton>
      </UiToolbar>
    </div>
    <div class="profile-list">
      <UiListItem
        v-for="config in transcriptionConfigs"
        :key="config.id"
        as="div"
        density="compact"
        class="profile-list__item"
        :selected="config.id === selectedConfigId"
        :data-testid="`feature-transcription-config-${config.id}`"
        @click="$emit('select', config.id)"
      >
        <span class="profile-list__content">
          <UiInput
            v-if="editingConfigId === config.id"
            class="profile-list__name-input"
            size="compact"
            data-testid="feature-transcription-config-name"
            :data-config-id="config.id"
            v-model="draftConfigName"
            :aria-label="t('feature-transcription-config-name')"
            @click.stop
            @mousedown.stop
            @keydown="onConfigNameInputKeydown"
            @blur="commitConfigName(config.id)"
          />
          <UiButton
            v-else
            variant="editable"
            size="sm"
            block
            data-testid="feature-transcription-config-name-action"
            @click.stop="startConfigNameEdit(config)"
            @mousedown.stop
          >
            {{ config.name }}
          </UiButton>
          <span class="profile-list__meta">{{ providerLabel(config) }}</span>
        </span>
        <button
          type="button"
          class="profile-list__status-action"
          :class="{ 'is-active': config.id === activeConfigId }"
          :aria-label="config.id === activeConfigId ? t('feature-transcription-active') : t('feature-transcription-make-active')"
          :aria-pressed="config.id === activeConfigId ? 'true' : 'false'"
          :data-testid="`feature-transcription-config-active-${config.id}`"
          @click.stop="$emit('activate', config.id)"
          @mousedown.stop
        >
          <IconCheck v-if="config.id === activeConfigId" size="sm" />
        </button>
      </UiListItem>
      <UiEmptyState v-if="!transcriptionConfigs.length" :message="t('feature-transcription-no-config')" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { TranscriptionConfig } from "../../../../main/types";
import { IconAdd, IconCheck, IconCopy, IconDelete } from "../../icons";
import { UiButton, UiEmptyState, UiIconButton, UiInput, UiListItem, UiToolbar } from "../../ui";

const props = defineProps<{
  transcriptionConfigs: TranscriptionConfig[];
  activeConfigId: string;
  selectedConfigId: string;
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  add: [];
  duplicate: [];
  delete: [];
  rename: [id: string, name: string];
  select: [id: string];
  activate: [id: string];
}>();

const editingConfigId = ref<string | null>(null);
const draftConfigName = ref("");

function providerLabel(config: TranscriptionConfig): string {
  return config.provider === "faster-whisper" ? "Faster-Whisper" : "Whisper API";
}

async function startConfigNameEdit(config: TranscriptionConfig) {
  emit("select", config.id);
  editingConfigId.value = config.id;
  draftConfigName.value = config.name;
  await nextTick();
  const input = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid="feature-transcription-config-name"]')).find(
    (element) => element.dataset.configId === config.id
  );
  input?.focus();
  input?.select();
}

function cancelConfigNameEdit() {
  editingConfigId.value = null;
  draftConfigName.value = "";
}

function onConfigNameInputKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLInputElement).blur();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelConfigNameEdit();
  }
}

function commitConfigName(configId: string) {
  const name = draftConfigName.value.trim();
  const currentName = props.transcriptionConfigs.find((config) => config.id === configId)?.name.trim() ?? "";
  editingConfigId.value = null;
  draftConfigName.value = "";
  if (!name.length || name === currentName) {
    return;
  }
  emit("rename", configId, name);
}
</script>
