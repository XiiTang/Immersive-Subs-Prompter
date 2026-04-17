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
          v-for="profile in profiles"
          :key="profile.id"
          type="button"
          class="profile-list__item"
          :class="{ 'is-selected': profile.id === editingProfileId }"
          @click="$emit('select', profile.id)"
        >
          <span class="profile-list__name">{{ profile.name }}</span>
          <span v-if="profile.id === activeProfileId" class="profile-list__badge">
            {{ t("active-badge", "Applied") }}
          </span>
          <span v-else-if="profile.id === defaultProfileId" class="profile-list__badge">
            {{ t("default-badge", "Default") }}
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
import { computed } from "vue";
import { IconAdd, IconDelete } from "../../icons";
import { useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import type { ProfileDefinition } from "../../../../main/types.js";

interface Props {
  profiles: readonly ProfileDefinition[];
  editingProfileId: string | null;
  activeProfileId: string | null;
  defaultProfileId: string | null;
  canDelete: boolean;
  canSetDefault: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: "add"): void;
  (e: "duplicate"): void;
  (e: "delete"): void;
  (e: "set-default"): void;
  (e: "select", profileId: string): void;
}>();

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
</script>

