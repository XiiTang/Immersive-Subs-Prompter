<template>
  <PopoverRoot>
    <PopoverTrigger as-child :aria-label="label">
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="ui-popover" data-slot="popover-content" :side="side" :side-offset="sideOffset">
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";

withDefaults(
  defineProps<{
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
  }>(),
  {
    side: "bottom",
    sideOffset: 6
  }
);
</script>
