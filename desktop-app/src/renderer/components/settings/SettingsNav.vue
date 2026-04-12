<template>
  <nav class="settings-nav" data-testid="settings-nav" aria-label="Settings sections">
    <div class="settings-nav__meta">
      <p class="settings-nav__eyebrow">Preferences</p>
      <h1 class="settings-nav__title">Settings</h1>
    </div>
    <button
      v-for="section in sections"
      :key="section.id"
      type="button"
      class="settings-nav__item"
      :data-testid="`settings-nav-item-${section.id}`"
      :aria-current="section.id === currentSection ? 'location' : undefined"
      @click="$emit('select', section.id)"
    >
      <span class="settings-nav__item-label">{{ section.label }}</span>
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
