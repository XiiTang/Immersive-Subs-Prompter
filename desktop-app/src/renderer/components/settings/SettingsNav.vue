<template>
  <nav class="settings-nav" data-testid="settings-nav" aria-label="Settings sections">
    <button
      v-for="section in sections"
      :key="section.id"
      type="button"
      class="settings-nav__item"
      :data-testid="`settings-nav-item-${section.id}`"
      :aria-current="section.id === currentSection ? 'page' : undefined"
      @click="$emit('select', section.id)"
    >
      {{ section.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { SETTINGS_SECTIONS, SettingsSectionId } from "./settingsSections";

defineProps<{
  sections: typeof SETTINGS_SECTIONS;
  currentSection: SettingsSectionId;
}>();

defineEmits<{
  select: [id: SettingsSectionId];
}>();
</script>
