<template>
  <div class="ui-color-input" :class="`ui-color-input--${size}`" data-slot="color-input">
    <button
      ref="triggerEl"
      type="button"
      class="ui-color-input__trigger"
      data-testid="color-label-trigger"
      :style="{ color: displayValue }"
      :disabled="disabled || readonly"
      @click="togglePalette"
      @keydown.esc="closePalette(true)"
    >
      {{ label }}
    </button>

    <Teleport to="body">
      <div
        v-if="paletteOpen"
        ref="paletteEl"
        class="ui-color-input__palette"
        data-testid="color-palette"
        :style="paletteStyle"
        @keydown.esc="closePalette(true)"
      >
        <div
          ref="areaEl"
          class="ui-color-input__area"
          data-testid="color-area"
          :style="areaStyle"
          @pointerdown="handleAreaPointerDown"
        >
          <span class="ui-color-input__area-thumb" :style="areaThumbStyle" />
        </div>

        <div
          ref="hueSliderEl"
          class="ui-color-input__slider"
          data-testid="color-hue-slider"
          @pointerdown="handleHuePointerDown"
        >
          <span class="ui-color-input__slider-track" :style="hueTrackStyle" />
          <span class="ui-color-input__slider-thumb" :style="hueThumbStyle" />
        </div>

        <div class="ui-color-input__channels" aria-label="RGB color channels">
          <label
            v-for="channel in colorChannels"
            :key="channel.channel"
            class="ui-color-input__channel"
          >
            <span class="ui-color-input__channel-label">{{ channel.label }}</span>
            <input
              class="ui-input ui-color-input__channel-input"
              :data-testid="channel.testId"
              :aria-label="`${label} ${channel.label} channel`"
              inputmode="numeric"
              spellcheck="false"
              :disabled="disabled"
              :readonly="readonly"
              :value="rgbValue[channel.channel]"
              @input="handleRgbInput(channel.channel, $event)"
              @blur="commitColor()"
            />
          </label>
        </div>

        <input
          class="ui-input ui-color-input__field"
          :aria-label="`${label} color code`"
          spellcheck="false"
          :disabled="disabled"
          :readonly="readonly"
          :placeholder="placeholder"
          :value="hexFieldValue"
          @input="handleHexInput"
          @blur="commitHexInput"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type CSSProperties } from "vue";

type RgbChannel = "red" | "green" | "blue";
type Rgb = Record<RgbChannel, number>;
type Hsv = {
  hue: number;
  saturation: number;
  value: number;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    disabled?: boolean;
    readonly?: boolean;
    placeholder?: string;
    size?: "default" | "compact";
  }>(),
  {
    disabled: false,
    readonly: false,
    placeholder: "#ffffff",
    size: "default"
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

const triggerEl = ref<HTMLButtonElement | null>(null);
const paletteEl = ref<HTMLElement | null>(null);
const areaEl = ref<HTMLElement | null>(null);
const hueSliderEl = ref<HTMLElement | null>(null);
const paletteOpen = ref(false);
const paletteStyle = ref<CSSProperties>({});
const draftValue = ref(normalizeHexColor(props.modelValue, props.placeholder));
const commitBaseValue = ref(draftValue.value);
const hexFieldValue = ref(draftValue.value);
const propValue = computed(() => normalizeHexColor(props.modelValue, props.placeholder));
const displayValue = computed(() => (paletteOpen.value ? draftValue.value : propValue.value));
const rgbValue = computed(() => hexToRgb(draftValue.value));
const hsvValue = computed(() => rgbToHsv(rgbValue.value));
const areaStyle = computed(() => ({
  background: [
    "linear-gradient(to top, #000000, rgb(0 0 0 / 0))",
    `linear-gradient(to right, #ffffff, hsl(${hsvValue.value.hue} 100% 50%))`
  ].join(", ")
}));
const areaThumbStyle = computed(() => ({
  left: `${hsvValue.value.saturation * 100}%`,
  top: `${(1 - hsvValue.value.value) * 100}%`
}));
const hueTrackStyle = {
  background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
};
const hueThumbStyle = computed(() => ({
  left: `${(hsvValue.value.hue / 360) * 100}%`
}));

watch(propValue, (value) => {
  if (!paletteOpen.value) {
    draftValue.value = value;
    hexFieldValue.value = value;
  }
});

watch(paletteOpen, (isOpen) => {
  if (isOpen) {
    draftValue.value = propValue.value;
    commitBaseValue.value = propValue.value;
    hexFieldValue.value = draftValue.value;
    void nextTick(() => {
      updatePalettePosition();
      document.addEventListener("pointerdown", handleDocumentPointerDown, true);
      document.addEventListener("keydown", handleDocumentKeydown, true);
      window.addEventListener("resize", updatePalettePosition);
      window.addEventListener("scroll", updatePalettePosition, true);
    });
  } else {
    removeDocumentListeners();
  }
});

onBeforeUnmount(removeDocumentListeners);

function togglePalette() {
  if (props.disabled || props.readonly) {
    return;
  }
  paletteOpen.value = !paletteOpen.value;
}

function closePalette(returnFocus: boolean) {
  paletteOpen.value = false;
  if (returnFocus) {
    void nextTick(() => triggerEl.value?.focus());
  }
}

function handleAreaPointerDown(event: PointerEvent) {
  if (props.disabled || props.readonly) {
    return;
  }
  event.preventDefault();
  updateFromAreaPointer(event);
  document.addEventListener("pointermove", updateFromAreaPointer);
  document.addEventListener("pointerup", handlePointerCommit, { once: true });
}

function handleHuePointerDown(event: PointerEvent) {
  if (props.disabled || props.readonly) {
    return;
  }
  event.preventDefault();
  updateFromHuePointer(event);
  document.addEventListener("pointermove", updateFromHuePointer);
  document.addEventListener("pointerup", handlePointerCommit, { once: true });
}

function handlePointerCommit() {
  document.removeEventListener("pointermove", updateFromAreaPointer);
  document.removeEventListener("pointermove", updateFromHuePointer);
  commitColor();
}

function updateFromAreaPointer(event: PointerEvent) {
  const target = areaEl.value;
  if (!target) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const nextHsv = {
    ...hsvValue.value,
    saturation: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    value: clamp(1 - (event.clientY - rect.top) / Math.max(1, rect.height), 0, 1)
  };
  updateDraft(rgbToHex(hsvToRgb(nextHsv)));
}

function updateFromHuePointer(event: PointerEvent) {
  const target = hueSliderEl.value;
  if (!target) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const nextHsv = {
    ...hsvValue.value,
    hue: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1) * 360
  };
  updateDraft(rgbToHex(hsvToRgb(nextHsv)));
}

function handleRgbInput(channel: RgbChannel, event: Event) {
  if (props.disabled || props.readonly) {
    return;
  }
  const target = event.target as HTMLInputElement;
  const nextRgb = {
    ...rgbValue.value,
    [channel]: clamp(Math.round(Number(target.value) || 0), 0, 255)
  };
  updateDraft(rgbToHex(nextRgb));
}

function handleHexInput(event: Event) {
  if (props.disabled || props.readonly) {
    return;
  }
  const target = event.target as HTMLInputElement;
  hexFieldValue.value = target.value.toLowerCase();
  const completeHex = normalizeSixDigitHexColor(hexFieldValue.value);
  if (completeHex) {
    updateDraft(completeHex);
  }
}

function commitHexInput() {
  const normalized = normalizeHexColor(hexFieldValue.value, draftValue.value);
  updateDraft(normalized);
  commitColor(normalized);
}

function updateDraft(value: string) {
  const normalized = normalizeHexColor(value, draftValue.value);
  hexFieldValue.value = normalized;
  if (normalized === draftValue.value) {
    return;
  }
  draftValue.value = normalized;
  if (normalized !== propValue.value) {
    emit("update:modelValue", normalized);
  }
}

function commitColor(value = draftValue.value) {
  const normalized = normalizeHexColor(value, draftValue.value);
  draftValue.value = normalized;
  if (normalized !== commitBaseValue.value) {
    emit("change", normalized);
    commitBaseValue.value = normalized;
  }
}

function updatePalettePosition() {
  const trigger = triggerEl.value;
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const width = 228;
  const left = Math.min(Math.max(8, rect.left + (rect.width - width) / 2), Math.max(8, window.innerWidth - width - 8));
  const belowTop = rect.bottom + 8;
  const aboveTop = rect.top - 260;
  const top = belowTop + 248 <= window.innerHeight ? belowTop : Math.max(8, aboveTop);
  paletteStyle.value = {
    left: `${left}px`,
    position: "fixed",
    top: `${top}px`
  };
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target || triggerEl.value?.contains(target) || paletteEl.value?.contains(target)) {
    return;
  }
  closePalette(false);
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closePalette(true);
  }
}

function removeDocumentListeners() {
  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  document.removeEventListener("keydown", handleDocumentKeydown, true);
  document.removeEventListener("pointermove", updateFromAreaPointer);
  document.removeEventListener("pointermove", updateFromHuePointer);
  document.removeEventListener("pointerup", handlePointerCommit);
  window.removeEventListener("resize", updatePalettePosition);
  window.removeEventListener("scroll", updatePalettePosition, true);
}

function normalizeHexColor(value: string, fallback: string) {
  const trimmed = value.trim();
  const sixDigit = trimmed.match(/^#?([0-9a-f]{6})$/i);
  if (sixDigit?.[1]) {
    return `#${sixDigit[1].toLowerCase()}`;
  }
  return fallback.match(/^#[0-9a-f]{6}$/i) ? fallback.toLowerCase() : "#ffffff";
}

function normalizeSixDigitHexColor(value: string) {
  const sixDigit = value.trim().match(/^#?([0-9a-f]{6})$/i);
  return sixDigit?.[1] ? `#${sixDigit[1].toLowerCase()}` : null;
}

function hexToRgb(hex: string): Rgb {
  const value = normalizeHexColor(hex, "#ffffff").slice(1);
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex(rgb: Rgb) {
  return `#${toHex(rgb.red)}${toHex(rgb.green)}${toHex(rgb.blue)}`;
}

function toHex(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function rgbToHsv(rgb: Rgb): Hsv {
  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: max === 0 ? 0 : delta / max,
    value: max
  };
}

function hsvToRgb(hsv: Hsv): Rgb {
  const chroma = hsv.value * hsv.saturation;
  const huePrime = hsv.hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = hsv.value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    red: (red + match) * 255,
    green: (green + match) * 255,
    blue: (blue + match) * 255
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
</script>
