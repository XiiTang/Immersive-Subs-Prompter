<template>
  <Mic
    :class="iconClass(size)"
    :size="iconSizePx[size]"
    :stroke-width="2"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { Mic } from "@lucide/vue";
import { iconClass, iconSizePx, type IconSize } from "./iconSizing";

const { size = "md" } = defineProps<{ size?: IconSize }>();
</script>
