<template>
  <svg class="icon" :class="[sizeClass]" xmlns="http://www.w3.org/2000/svg" :viewBox="ICON_SETTINGS.viewBox" v-bind="ICON_STROKE_PROPS" aria-hidden="true">
    <component v-for="(segment, index) in ICON_SETTINGS.segments" :is="segment.tag" :key="index" v-bind="segment.attrs" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ICON_SETTINGS, ICON_STROKE_PROPS } from "../../shared/iconDefs";

const { size = "md" } = defineProps<{ size?: "sm" | "md" | "lg" }>();
const sizeClass = computed(() => `icon--${size}`);
</script>
