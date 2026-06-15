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
      <span v-if="resolveIconComponent(section.icon)" class="settings-nav__icon" aria-hidden="true">
        <component :is="resolveIconComponent(section.icon)" size="md" />
      </span>
      <span class="settings-nav__item-label">{{ section.label }}</span>
    </UiButton>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import { IconBookOpen, IconFeatures, IconMic, IconServer, IconSettings, IconUser } from "../icons";
import { UiButton } from "../ui";
import type { SettingsNavIconKey, SettingsSectionId } from "./settingsSections";

defineProps<{
  sections: ReadonlyArray<{
    id: SettingsSectionId;
    label: string;
    icon?: SettingsNavIconKey;
  }>;
  currentSection: SettingsSectionId;
  navAriaLabel: string;
}>();

defineEmits<{
  select: [id: SettingsSectionId];
}>();

const navIconComponents: Partial<Record<SettingsNavIconKey, Component>> = {
  features: IconFeatures,
  mediaServer: IconServer,
  profiles: IconUser,
  settings: IconSettings,
  transcription: IconMic,
  wordLookup: IconBookOpen
};

function resolveIconComponent(icon?: SettingsNavIconKey): Component | null {
  return icon ? navIconComponents[icon] ?? null : null;
}
</script>
