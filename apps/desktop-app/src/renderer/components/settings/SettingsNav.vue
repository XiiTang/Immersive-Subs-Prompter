<template>
  <nav class="settings-nav" data-testid="settings-nav" :aria-label="navAriaLabel">
    <UiButton
      v-for="section in sections"
      :key="section.id"
      type="button"
      variant="ghost"
      size="sm"
      class="settings-nav__item"
      :data-testid="`settings-nav-item-${section.id}`"
      :aria-current="section.id === currentSection ? 'location' : undefined"
      @click="$emit('select', section.id)"
    >
      <span class="settings-nav__item-label">{{ section.label }}</span>
    </UiButton>
  </nav>
</template>

<script setup lang="ts">
import { UiButton } from "../ui";
import type { SettingsSectionId } from "./settingsSections";

defineProps<{
  sections: ReadonlyArray<{
    id: SettingsSectionId;
    label: string;
    anchorId: string;
  }>;
  currentSection: SettingsSectionId;
  navAriaLabel: string;
}>();

defineEmits<{
  select: [id: SettingsSectionId];
}>();
</script>
