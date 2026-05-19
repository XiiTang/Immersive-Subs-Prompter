<template>
  <div class="settings-split__sidebar">
    <div class="settings-split__sidebar-header">
      <span class="settings-field__label">{{ t("profile-list-label", "Profile List") }}</span>
      <div class="settings-split__sidebar-buttons">
        <button
          type="button"
          class="icon-button"
          :title="t('button-add', 'Add')"
          :aria-label="t('button-add', 'Add')"
          @click="$emit('add')"
        >
          <IconAdd size="md" />
        </button>
        <button type="button" class="text-button" @click="$emit('duplicate')">
          {{ t("button-duplicate", "Duplicate") }}
        </button>
        <button
          type="button"
          class="icon-button"
          :disabled="!canDelete"
          :title="t('button-delete', 'Delete')"
          :aria-label="t('button-delete', 'Delete')"
          @click="$emit('delete')"
        >
          <IconDelete size="md" />
        </button>
      </div>
    </div>
    <div class="profile-list settings-list">
      <template v-if="profiles.length">
        <button
          v-for="(profile, index) in profiles"
          :key="profile.id"
          type="button"
          class="profile-list__item"
          :class="{ 'is-selected': profile.id === editingProfileId, 'is-drag-over': dragOverIndex === index }"
          draggable="true"
          @click="$emit('select', profile.id)"
          @dragstart="onDragStart($event, index)"
          @dragover.prevent="dragOverIndex = index"
          @dragleave="dragOverIndex = null"
          @drop.prevent="onDrop(index)"
          @dragend="resetDrag"
        >
          <span class="profile-list__content">
            <span class="profile-list__name">{{ profile.name }}</span>
            <span class="profile-list__meta">{{ profileRuleSummary(profile.id) }}</span>
          </span>
          <span class="profile-list__badges">
            <span v-if="profile.id === activeProfileId" class="profile-list__badge">
              {{ t("active-badge", "Applied") }}
            </span>
            <span v-else-if="profile.id === defaultProfileId" class="profile-list__badge">
              {{ t("default-badge", "Default") }}
            </span>
          </span>
        </button>
      </template>
      <div v-else class="profile-list__empty">{{ t("profile-empty", "No profiles") }}</div>
    </div>
    <div class="settings-split__sidebar-actions">
      <button
        type="button"
        class="text-button"
        :disabled="!canSetDefault"
        @click="$emit('set-default')"
      >
        {{ t("button-set-default", "Set as Default") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { IconAdd, IconDelete } from "../../icons";
import { useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import type { ProfileDefinition, ProfileRule } from "../../../../main/types.js";

interface Props {
  profiles: readonly ProfileDefinition[];
  rules: readonly ProfileRule[];
  editingProfileId: string | null;
  activeProfileId: string | null;
  defaultProfileId: string | null;
  canDelete: boolean;
  canSetDefault: boolean;
}

const props = defineProps<Props>();

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

const emit = defineEmits<{
  (e: "add"): void;
  (e: "duplicate"): void;
  (e: "delete"): void;
  (e: "set-default"): void;
  (e: "select", profileId: string): void;
  (e: "reorder", fromIndex: number, toIndex: number): void;
}>();

function profileRuleSummary(profileId: string): string {
  if (profileId === props.defaultProfileId) {
    return t("profile-url-default-summary", "Fallback");
  }
  const patterns = props.rules
    .filter((rule) => rule.profileId === profileId)
    .map((rule) => rule.pattern);
  if (!patterns.length) {
    return t("profile-url-empty-summary", "No URL rules");
  }
  const visible = patterns.slice(0, 2).join(", ");
  const remaining = patterns.length - 2;
  return remaining > 0 ? `${visible} +${remaining}` : visible;
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
    emit("reorder", dragIndex.value, index);
  }
  resetDrag();
}

function resetDrag() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}
</script>
