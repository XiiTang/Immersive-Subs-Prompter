<template>
  <svg
    class="icon icon--delete"
    :class="[sizeClass]"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 5h8" />
    <path d="M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
    <path d="M5 5v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5" />
    <line x1="7" y1="8" x2="7" y2="11" />
    <line x1="9" y1="8" x2="9" y2="11" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  size?: "sm" | "md" | "lg";
}>();

const sizeClass = computed(() => `icon--${props.size || "md"}`);
</script>
