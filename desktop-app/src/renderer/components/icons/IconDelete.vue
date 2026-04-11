<template>
  <svg
    class="icon icon--delete"
    :class="[sizeClass]"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="ICON_DELETE.viewBox"
    v-bind="ICON_STROKE_PROPS"
    aria-hidden="true"
  >
    <component
      v-for="(segment, index) in ICON_DELETE.segments"
      :is="segment.tag"
      :key="index"
      v-bind="segment.attrs"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ICON_DELETE, ICON_STROKE_PROPS } from "../../shared/iconDefs";

const { size = "md" } = defineProps<{
  size?: "sm" | "md" | "lg";
}>();

const sizeClass = computed(() => `icon--${size}`);
</script>
