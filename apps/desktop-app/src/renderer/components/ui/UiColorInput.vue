<template>
  <div class="ui-color-input" data-slot="color-input">
    <PopoverRoot :open="paletteOpen" @update:open="handlePaletteOpen">
      <PopoverTrigger as-child>
        <button
          type="button"
          class="ui-color-input__trigger"
          data-testid="color-label-trigger"
          :style="{ color: displayValue }"
          :disabled="disabled || readonly"
        >
          {{ label }}
        </button>
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent
          class="ui-color-input__palette"
          data-testid="color-palette"
          side="bottom"
          align="center"
          :side-offset="8"
        >
          <ColorAreaRoot
            v-slot="{ style }"
            :model-value="draftValue"
            color-space="hsb"
            x-channel="saturation"
            y-channel="brightness"
            :disabled="disabled || readonly"
            @update:model-value="setDraftColor"
            @change-end="commitColor"
          >
            <ColorAreaArea
              class="ui-color-input__area"
              data-testid="color-area"
              :style="style"
            >
              <ColorAreaThumb class="ui-color-input__area-thumb" />
            </ColorAreaArea>
          </ColorAreaRoot>

          <ColorSliderRoot
            class="ui-color-input__slider"
            data-testid="color-hue-slider"
            :model-value="draftValue"
            color-space="hsb"
            channel="hue"
            :disabled="disabled || readonly"
            @update:model-value="setDraftColor"
            @change-end="commitColor"
          >
            <ColorSliderTrack class="ui-color-input__slider-track" />
            <ColorSliderThumb class="ui-color-input__slider-thumb" />
          </ColorSliderRoot>

          <div class="ui-color-input__channels" aria-label="RGB color channels">
            <ColorFieldRoot
              v-for="channel in colorChannels"
              :key="channel.channel"
              class="ui-color-input__channel"
              :model-value="draftValue"
              color-space="rgb"
              :channel="channel.channel"
              :disabled="disabled"
              :readonly="readonly"
              @update:model-value="commitColor"
            >
              <span class="ui-color-input__channel-label">{{ channel.label }}</span>
              <ColorFieldInput
                class="ui-input ui-color-input__channel-input"
                :data-testid="channel.testId"
                :aria-label="`${label} ${channel.label} channel`"
                spellcheck="false"
              />
            </ColorFieldRoot>
          </div>

          <ColorFieldRoot
            class="ui-color-input__field-root"
            :model-value="draftValue"
            :disabled="disabled"
            :readonly="readonly"
            :placeholder="placeholder"
            @update:model-value="commitColor"
          >
            <ColorFieldInput
              class="ui-input ui-color-input__field"
              :aria-label="`${label} color code`"
              spellcheck="false"
            />
          </ColorFieldRoot>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  type Color,
  ColorAreaArea,
  ColorAreaRoot,
  ColorAreaThumb,
  ColorFieldInput,
  ColorFieldRoot,
  ColorSliderRoot,
  ColorSliderThumb,
  ColorSliderTrack,
  colorToString,
  normalizeColor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from "reka-ui";

type RgbChannel = "red" | "green" | "blue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    disabled?: boolean;
    readonly?: boolean;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    readonly: false,
    placeholder: "#ffffff"
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
}>();

const colorChannels: Array<{ channel: RgbChannel; label: string; testId: string }> = [
  { channel: "red", label: "R", testId: "color-channel-red" },
  { channel: "green", label: "G", testId: "color-channel-green" },
  { channel: "blue", label: "B", testId: "color-channel-blue" }
];

const paletteOpen = ref(false);
const draftValue = ref(normalizeHexColor(props.modelValue));
const lastEmittedValue = ref<string | null>(null);
const propValue = computed(() => normalizeHexColor(props.modelValue));
const displayValue = computed(() => (paletteOpen.value ? draftValue.value : propValue.value));

watch(propValue, (value) => {
  draftValue.value = value;
  if (lastEmittedValue.value === value) {
    lastEmittedValue.value = null;
  }
});

function handlePaletteOpen(open: boolean) {
  paletteOpen.value = open;
  if (open) {
    draftValue.value = propValue.value;
  }
}

function setDraftColor(value: string | Color) {
  const normalized = normalizeHexColor(value);
  draftValue.value = normalized;
  emitColorUpdate(normalized);
}

function commitColor(value: string | Color = draftValue.value) {
  const normalized = normalizeHexColor(value);
  draftValue.value = normalized;
  emitColorUpdate(normalized);
  emit("change", normalized);
}

function emitColorUpdate(normalized: string) {
  if (normalized !== propValue.value && normalized !== lastEmittedValue.value) {
    lastEmittedValue.value = normalized;
    emit("update:modelValue", normalized);
  }
}

function normalizeHexColor(value: string | Color): string {
  try {
    return colorToString(normalizeColor(value), "hex");
  } catch {
    return "#000000";
  }
}
</script>
