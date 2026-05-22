<template>
  <TooltipProvider :delay-duration="delayDuration">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="ui-tooltip" data-slot="tooltip-content" :side="side" :side-offset="sideOffset">
          {{ text }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from "reka-ui";

withDefaults(
  defineProps<{
    text: string;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    delayDuration?: number;
  }>(),
  {
    side: "top",
    sideOffset: 6,
    delayDuration: 250
  }
);
</script>
