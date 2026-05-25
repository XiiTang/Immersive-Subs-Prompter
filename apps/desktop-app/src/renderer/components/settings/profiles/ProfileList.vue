<template>
  <div class="settings-split__sidebar">
    <div class="settings-split__sidebar-header">
      <div class="settings-split__sidebar-buttons">
        <UiIconButton :label="t('button-add', 'Add')" @click="$emit('add')">
          <IconAdd size="md" />
        </UiIconButton>
        <UiIconButton :label="t('button-duplicate', 'Duplicate')" @click="$emit('duplicate')">
          <IconCopy size="md" />
        </UiIconButton>
        <UiIconButton
          :disabled="!canDelete"
          variant="danger"
          :label="t('button-delete', 'Delete')"
          @click="$emit('delete')"
        >
          <IconDelete size="md" />
        </UiIconButton>
      </div>
    </div>
    <div class="profile-list ui-list">
      <template v-if="profiles.length">
        <UiListItem
          v-for="(profile, index) in profiles"
          :key="profile.id"
          as="div"
          class="profile-list__item"
          :class="{ 'is-drag-over': dragOverIndex === index }"
          :selected="profile.id === editingProfileId"
          :draggable="!isFallbackProfile(profile.id)"
          @click="$emit('select', profile.id)"
          @dragstart="onDragStart($event, index, profile.id)"
          @dragover.prevent="dragOverIndex = index"
          @dragleave="dragOverIndex = null"
          @drop.prevent="onDrop(index)"
          @dragend="resetDrag"
        >
          <span class="profile-list__content">
            <UiInput
              v-if="editingNameProfileId === profile.id"
              class="profile-list__name-input"
              data-testid="profile-list-name-input"
              :data-profile-id="profile.id"
              v-model="draftProfileName"
              :aria-label="t('profile-name-label', 'Profile Name')"
              @click.stop
              @mousedown.stop
              @dragstart.stop
              @keydown.enter.prevent.stop="($event.target as HTMLInputElement).blur()"
              @keydown.escape.prevent.stop="cancelProfileNameEdit"
              @blur="commitProfileName(profile.id)"
            />
            <UiButton
              v-else
              variant="ghost"
              size="sm"
              class="profile-list__name-action"
              data-testid="profile-list-name-action"
              @click.stop="startProfileNameEdit(profile)"
              @mousedown.stop
              @dragstart.stop
            >
              {{ profile.name }}
            </UiButton>
            <span class="profile-list__meta">{{ profileRuleSummary(profile.id) }}</span>
          </span>
        </UiListItem>
      </template>
      <UiEmptyState v-else :message="t('profile-empty', 'No profiles')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { IconAdd, IconCopy, IconDelete } from "../../icons";
import { useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import type { ProfileDefinition, ProfileRule } from "../../../../main/types.js";
import { UiButton, UiEmptyState, UiIconButton, UiInput, UiListItem } from "../../ui";

interface Props {
  profiles: readonly ProfileDefinition[];
  rules: readonly ProfileRule[];
  editingProfileId: string | null;
  defaultProfileId: string | null;
  canDelete: boolean;
}

const props = defineProps<Props>();

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const editingNameProfileId = ref<string | null>(null);
const draftProfileName = ref("");

const emit = defineEmits<{
  (e: "add"): void;
  (e: "duplicate"): void;
  (e: "delete"): void;
  (e: "select", profileId: string): void;
  (e: "reorder", fromIndex: number, toIndex: number): void;
  (e: "rename", profileId: string, name: string): void;
}>();

function isFallbackProfile(profileId: string): boolean {
  return profileId === props.defaultProfileId;
}

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

async function startProfileNameEdit(profile: ProfileDefinition) {
  emit("select", profile.id);
  editingNameProfileId.value = profile.id;
  draftProfileName.value = profile.name;
  await nextTick();
  const input = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid="profile-list-name-input"]')).find(
    (element) => element.dataset.profileId === profile.id
  );
  input?.focus();
  input?.select();
}

function cancelProfileNameEdit() {
  editingNameProfileId.value = null;
  draftProfileName.value = "";
}

function commitProfileName(profileId: string) {
  const name = draftProfileName.value.trim();
  editingNameProfileId.value = null;
  draftProfileName.value = "";
  if (!name.length) {
    return;
  }
  emit("rename", profileId, name);
}

function onDragStart(event: DragEvent, index: number, profileId: string) {
  if (isFallbackProfile(profileId)) {
    event.preventDefault();
    return;
  }
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
