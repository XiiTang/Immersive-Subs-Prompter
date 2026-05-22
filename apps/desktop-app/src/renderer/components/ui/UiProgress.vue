<template>
  <div
    class="ui-progress"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="boundedValue"
  >
    <div class="ui-progress__bar" :style="{ width: `${boundedValue}%` }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  value: number;
  label: string;
}>();

const boundedValue = computed(() => Math.max(0, Math.min(100, Math.round(props.value))));
</script>
