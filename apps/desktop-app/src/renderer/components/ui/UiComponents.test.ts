import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";
import {
  UiBadge,
  UiButton,
  UiColorInput,
  UiEmptyState,
  UiField,
  UiIconButton,
  UiInput,
  UiListItem,
  UiMessage,
  UiProgress,
  UiSection,
  UiSelect,
  UiSegmentedControl,
  UiSettingRow,
  UiSlider,
  UiStatus,
  UiSurface,
  UiSwitch,
  UiTextarea,
  UiToolbar,
  UiTooltip
} from "./index";

function createPointerEvent(type: string, init: Partial<PointerEvent>) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, {
      configurable: true,
      value
    });
  }
  return event;
}

function stubRect(element: Element, rect: Partial<DOMRect>) {
  const fullRect = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    top: 0,
    right: 100,
    bottom: 100,
    left: 0,
    toJSON: () => ({})
  };

  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ ...fullRect, ...rect })
  });
}

describe("UI primitives", () => {
  it("renders button variants with stable classes", () => {
    const wrapper = mount(UiButton, {
      props: { variant: "primary" },
      slots: { default: "Save" }
    });

    expect(wrapper.classes()).toContain("ui-button");
    expect(wrapper.classes()).toContain("ui-button--primary");
    expect(wrapper.text()).toBe("Save");
  });

  it("renders icon buttons with accessible labels", () => {
    const wrapper = mount(UiIconButton, {
      props: { label: "Refresh" },
      slots: { default: "R" }
    });

    expect(wrapper.attributes("aria-label")).toBe("Refresh");
    expect(wrapper.classes()).toContain("ui-icon-button");
  });

  it("connects field label, hint, and error text", () => {
    const wrapper = mount(UiField, {
      props: {
        id: "api-key",
        label: "API Key",
        hint: "Used by the provider",
        error: "Required"
      },
      slots: { default: '<input id="api-key" />' }
    });

    expect(wrapper.text()).toContain("API Key");
    expect(wrapper.text()).toContain("Used by the provider");
    expect(wrapper.text()).toContain("Required");
    expect(wrapper.get(".ui-field__label-row .ui-field__hint").text()).toBe("Used by the provider");
    expect(wrapper.get(".ui-field__control").attributes("aria-describedby")).toContain("api-key-hint");
    expect(wrapper.get(".ui-field__control").attributes("aria-describedby")).toContain("api-key-error");
  });

  it("renders setting rows with shared label, hint, value, error, and control slots", () => {
    const wrapper = mount(UiSettingRow, {
      props: {
        id: "cache-path",
        label: "Cache path",
        hint: "Folder for cached subtitles",
        value: "Enabled",
        error: "Folder is not writable",
        controlWidth: "wide"
      },
      slots: {
        default: '<input class="ui-input" />'
      }
    });

    expect(wrapper.classes()).toContain("ui-setting-row");
    expect(wrapper.classes()).toContain("ui-setting-row--wide");
    expect(wrapper.get(".ui-setting-row__label").attributes("id")).toBe("cache-path-label");
    expect(wrapper.get(".ui-setting-row__hint").attributes("id")).toBe("cache-path-hint");
    expect(wrapper.get(".ui-setting-row__error").attributes("id")).toBe("cache-path-error");
    expect(wrapper.get(".ui-setting-row__value").text()).toBe("Enabled");
    expect(wrapper.get(".ui-setting-row__control").attributes("aria-describedby")).toContain("cache-path-hint");
    expect(wrapper.get(".ui-setting-row__control").attributes("aria-describedby")).toContain("cache-path-error");
  });

  it("renders shared toolbar, surface, and message primitives", () => {
    const toolbar = mount(UiToolbar, {
      props: { label: "Panel actions", density: "compact" },
      slots: { default: "<button>Pin</button>" }
    });
    expect(toolbar.classes()).toContain("ui-toolbar");
    expect(toolbar.classes()).toContain("ui-toolbar--compact");
    expect(toolbar.attributes("aria-label")).toBe("Panel actions");

    const surface = mount(UiSurface, {
      props: { variant: "floating", padded: false },
      slots: { default: "Surface" }
    });
    expect(surface.classes()).toContain("ui-surface");
    expect(surface.classes()).toContain("ui-surface--floating");
    expect(surface.classes()).toContain("ui-surface--flush");

    const message = mount(UiMessage, {
      props: { tone: "warning" },
      slots: { default: "Check settings" }
    });
    expect(message.classes()).toContain("ui-message");
    expect(message.classes()).toContain("ui-message--warning");
    expect(message.attributes("role")).toBe("status");
  });

  it("labels composite field controls without wrapping button-like primitives in a label", () => {
    const wrapper = mount(defineComponent({
      components: { UiField, UiSelect },
      setup() {
        return {
          options: [
            { value: "system", label: "System" },
            { value: "dark", label: "Dark" }
          ]
        };
      },
      template: `
        <UiField id="theme" label="Theme">
          <UiSelect model-value="dark" :options="options" />
        </UiField>
      `
    }));

    expect(wrapper.get(".ui-field").element.tagName).toBe("DIV");
    expect(wrapper.get(".ui-field__label").attributes("id")).toBe("theme-label");
    expect(wrapper.get('[role="combobox"]').attributes("aria-labelledby")).toBe("theme-label");
    expect(wrapper.get('[role="combobox"]').attributes("aria-label")).toBeUndefined();
  });

  it("emits model updates from form controls", async () => {
    const input = mount(UiInput, { props: { modelValue: "one" } });
    await input.get("input").setValue("two");
    expect(input.emitted("update:modelValue")?.[0]).toEqual(["two"]);

    const textarea = mount(UiTextarea, { props: { modelValue: "a" } });
    await textarea.get("textarea").setValue("b");
    expect(textarea.emitted("update:modelValue")?.[0]).toEqual(["b"]);

    const select = mount(UiSelect, {
      props: {
        modelValue: "dark",
        ariaLabel: "Theme",
        options: [
          { value: "system", label: "System" },
          { value: "dark", label: "Dark" }
        ]
      },
      attachTo: document.body
    });
    expect(select.find("select").exists()).toBe(false);
    expect(select.get('[role="combobox"]').attributes("aria-label")).toBe("Theme");
    select.get('[role="combobox"]').element.dispatchEvent(
      createPointerEvent("pointerdown", {
        button: 0,
        ctrlKey: false,
        pageX: 0,
        pageY: 0,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
    await nextTick();
    const systemOption = document.body.querySelector('[data-value="system"]');
    expect(systemOption).toBeInstanceOf(HTMLElement);
    (systemOption as HTMLElement).focus();
    systemOption?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await nextTick();
    await nextTick();
    expect(select.emitted("update:modelValue")?.[0]).toEqual(["system"]);

    const toggle = mount(UiSwitch, { props: { modelValue: false, label: "On" } });
    expect(toggle.find('input[type="checkbox"]').exists()).toBe(false);
    expect(toggle.get('[role="switch"]').attributes("aria-checked")).toBe("false");
    await toggle.get('[role="switch"]').trigger("click");
    expect(toggle.emitted("update:modelValue")?.[0]).toEqual([true]);
  });

  it("renders select chrome with an icon, selected indicator, and optional font previews", async () => {
    const select = mount(UiSelect, {
      props: {
        modelValue: "georgia",
        ariaLabel: "Subtitle font",
        options: [
          { value: "inter", label: "Inter", fontFamilyPreview: "Inter, sans-serif" },
          { value: "georgia", label: "Georgia", fontFamilyPreview: "Georgia, serif" }
        ]
      },
      attachTo: document.body
    });

    const trigger = select.get('[role="combobox"]');
    expect(trigger.text()).not.toContain("⌄");
    expect(trigger.find(".ui-select__icon svg").exists()).toBe(true);
    expect(trigger.get(".ui-select__value").attributes("style")).toContain("font-family: Georgia, serif");

    trigger.element.dispatchEvent(
      createPointerEvent("pointerdown", {
        button: 0,
        ctrlKey: false,
        pageX: 0,
        pageY: 0,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
    await nextTick();

    const selectedOption = document.body.querySelector<HTMLElement>('[data-value="georgia"]');
    expect(selectedOption).toBeInstanceOf(HTMLElement);
    expect(selectedOption?.querySelector(".ui-select-item__check")).toBeInstanceOf(SVGElement);
    expect(selectedOption?.querySelector<HTMLElement>(".ui-select-item__label")?.getAttribute("style")).toContain(
      "font-family: Georgia, serif"
    );

    select.unmount();
  });

  it("focuses the select trigger after pointer open so keyboard selection continues", async () => {
    const beforeSelectButton = document.createElement("button");
    beforeSelectButton.type = "button";
    beforeSelectButton.textContent = "Before";
    document.body.append(beforeSelectButton);
    beforeSelectButton.focus();

    const select = mount(UiSelect, {
      props: {
        modelValue: "system",
        ariaLabel: "Theme",
        options: [
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" }
        ]
      },
      attachTo: document.body
    });

    const trigger = select.get<HTMLElement>('[role="combobox"]');
    trigger.element.dispatchEvent(
      createPointerEvent("pointerdown", {
        button: 0,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
    await nextTick();

    expect(document.activeElement).toBe(trigger.element);

    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await nextTick();

    expect(select.emitted("update:modelValue")?.[0]).toEqual(["light"]);

    select.unmount();
    beforeSelectButton.remove();
  });

  it("renders color input through the shared color primitive", async () => {
    const colorInput = mount(UiColorInput, {
      props: {
        modelValue: "#112233",
        label: "Primary Text"
      },
      attachTo: document.body
    });

    expect(colorInput.classes()).toContain("ui-color-input");
    expect(colorInput.find('[aria-roledescription="color swatch"]').exists()).toBe(false);
    expect(colorInput.find('[data-testid^="color-preset-"]').exists()).toBe(false);
    expect(colorInput.find('input[type="color"]').exists()).toBe(false);
    expect(colorInput.find(".ui-color-input__field").exists()).toBe(false);
    expect(document.body.querySelector('[data-testid="color-palette"]')).toBeNull();

    const trigger = colorInput.get('[data-testid="color-label-trigger"]');
    expect(trigger.text()).toBe("Primary Text");
    expect(trigger.attributes("style")).toContain("color:");

    await trigger.trigger("click");
    await nextTick();

    const palette = document.body.querySelector('[data-testid="color-palette"]');
    expect(palette).toBeInstanceOf(HTMLElement);
    expect(palette?.querySelector('[data-testid="color-area"]')).toBeInstanceOf(HTMLElement);
    expect(palette?.querySelector('[data-testid="color-hue-slider"]')).toBeInstanceOf(HTMLElement);
    expect(palette?.querySelector('[data-testid="color-channel-red"]')).toBeInstanceOf(HTMLInputElement);
    expect(palette?.querySelector('[data-testid="color-channel-green"]')).toBeInstanceOf(HTMLInputElement);
    expect(palette?.querySelector('[data-testid="color-channel-blue"]')).toBeInstanceOf(HTMLInputElement);

    const paletteField = palette?.querySelector(".ui-color-input__field");
    expect(paletteField).toBeInstanceOf(HTMLInputElement);
    expect((paletteField as HTMLInputElement).classList.contains("ui-input")).toBe(true);

    const colorArea = palette?.querySelector<HTMLElement>('[data-testid="color-area"]');
    stubRect(colorArea!, { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 });
    colorArea?.dispatchEvent(
      createPointerEvent("pointerdown", {
        clientX: 100,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
    await nextTick();
    expect(colorInput.emitted("update:modelValue")?.[0]).toEqual(["#0080ff"]);

    colorArea?.dispatchEvent(
      createPointerEvent("pointerup", {
        clientX: 100,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
    await nextTick();
    expect(colorInput.emitted("update:modelValue")).toHaveLength(1);
    expect(colorInput.emitted("change")?.[0]).toEqual(["#0080ff"]);

    const redField = palette?.querySelector('[data-testid="color-channel-red"]');
    (redField as HTMLInputElement).value = "68";
    redField?.dispatchEvent(new Event("input", { bubbles: true }));
    redField?.dispatchEvent(new Event("blur", { bubbles: true }));
    await nextTick();

    expect(colorInput.emitted("update:modelValue")?.[1]).toEqual(["#4480ff"]);
    expect(colorInput.emitted("change")?.[1]).toEqual(["#4480ff"]);

    (paletteField as HTMLInputElement).value = "#445566";
    paletteField?.dispatchEvent(new Event("input", { bubbles: true }));
    paletteField?.dispatchEvent(new Event("blur", { bubbles: true }));
    await nextTick();

    expect(colorInput.emitted("update:modelValue")?.[2]).toEqual(["#445566"]);
    expect(colorInput.emitted("change")?.[2]).toEqual(["#445566"]);

    colorInput.unmount();
  });

  it("keeps partial hex input local until a complete six-digit color is entered", async () => {
    const colorInput = mount(UiColorInput, {
      props: {
        modelValue: "#112233",
        label: "Primary Text"
      },
      attachTo: document.body
    });

    await colorInput.get('[data-testid="color-label-trigger"]').trigger("click");
    await nextTick();

    const paletteField = document.body.querySelector<HTMLInputElement>(".ui-color-input__field");
    expect(paletteField).toBeInstanceOf(HTMLInputElement);

    for (const value of ["#", "#4", "#44", "#445", "#4455", "#44556"]) {
      paletteField!.value = value;
      paletteField!.dispatchEvent(new Event("input", { bubbles: true }));
      await nextTick();

      expect(paletteField!.value).toBe(value);
      expect(colorInput.emitted("update:modelValue")).toBeUndefined();
    }

    paletteField!.value = "#abc";
    paletteField!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(paletteField!.value).toBe("#abc");
    expect(colorInput.emitted("update:modelValue")).toBeUndefined();

    paletteField!.dispatchEvent(new Event("blur", { bubbles: true }));
    await nextTick();
    expect(paletteField!.value).toBe("#112233");
    expect(colorInput.emitted("update:modelValue")).toBeUndefined();
    expect(colorInput.emitted("change")).toBeUndefined();

    paletteField!.value = "#445566";
    paletteField!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    expect(paletteField!.value).toBe("#445566");
    expect(colorInput.emitted("update:modelValue")?.[0]).toEqual(["#445566"]);

    colorInput.unmount();
  });

  it("emits a committed color change after the parent syncs live v-model updates", async () => {
    const wrapper = mount(defineComponent({
      components: { UiColorInput },
      setup() {
        const color = ref("#112233");
        const changes = ref<string[]>([]);
        return {
          changes,
          color,
          recordChange(value: string) {
            changes.value.push(value);
          }
        };
      },
      template: `
        <UiColorInput
          v-model="color"
          label="Primary Text"
          @change="recordChange"
        />
      `
    }), {
      attachTo: document.body
    });

    await wrapper.get('[data-testid="color-label-trigger"]').trigger("click");
    await nextTick();

    const colorArea = document.body.querySelector<HTMLElement>('[data-testid="color-area"]');
    expect(colorArea).toBeInstanceOf(HTMLElement);
    stubRect(colorArea!, { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 });
    colorArea!.dispatchEvent(
      createPointerEvent("pointerdown", {
        clientX: 100,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
    await nextTick();

    expect((wrapper.vm as unknown as { color: string }).color).toBe("#0080ff");
    expect((wrapper.vm as unknown as { changes: string[] }).changes).toEqual([]);

    document.dispatchEvent(
      createPointerEvent("pointerup", {
        clientX: 100,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
    await nextTick();

    expect((wrapper.vm as unknown as { changes: string[] }).changes).toEqual(["#0080ff"]);

    wrapper.unmount();
  });

  it("renders slider with native event passthrough for playback scrubbing", async () => {
    const slider = mount(UiSlider, {
      props: {
        modelValue: 10,
        min: 0,
        max: 100,
        step: 1,
        label: "Playback position"
      }
    });

    const input = slider.get('input[type="range"]');
    expect(input.attributes("aria-label")).toBe("Playback position");
    expect(input.attributes("style")).toContain("--slider-progress: 10%");
    await input.setValue("42");

    expect(slider.emitted("update:modelValue")?.[0]).toEqual([42]);
    expect(slider.emitted("input")?.[0]?.[0]).toBeInstanceOf(Event);
  });

  it("opens tooltip content for keyboard focus and closes it with Escape", async () => {
    const tooltip = mount(UiTooltip, {
      props: { text: "Refresh cache" },
      slots: { default: "<button>Refresh</button>" },
      attachTo: document.body
    });

    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    expect(tooltip.get("button").text()).toBe("Refresh");

    await tooltip.get("button").trigger("focusin");
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    await nextTick();

    const content = document.body.querySelector('[role="tooltip"]');
    expect(content).toBeInstanceOf(HTMLElement);
    expect(content?.textContent).toBe("Refresh cache");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();

    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

    tooltip.unmount();
  });

  it("keeps tooltip open while pointer movement stays inside the slotted trigger", async () => {
    const tooltip = mount(UiTooltip, {
      props: { text: "Refresh cache", delayDuration: 0 },
      slots: { default: '<button><span class="tooltip-icon">R</span>Refresh</button>' },
      attachTo: document.body
    });

    const trigger = tooltip.get(".ui-tooltip-trigger").element;
    const button = tooltip.get("button").element;
    const icon = tooltip.get(".tooltip-icon").element;
    trigger.dispatchEvent(createPointerEvent("pointerenter", { pointerId: 1, pointerType: "mouse" }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await nextTick();

    expect(document.body.querySelector('[role="tooltip"]')).toBeInstanceOf(HTMLElement);

    button.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: icon }));
    await nextTick();

    expect(document.body.querySelector('[role="tooltip"]')).toBeInstanceOf(HTMLElement);

    tooltip.unmount();
  });

  it("renders section, list item, badge, status, and empty state classes", () => {
    expect(mount(UiSection, { props: { title: "General" } }).classes()).toContain("ui-section");
    expect(mount(UiListItem, { props: { selected: true } }).classes()).toContain("is-selected");
    expect(mount(UiBadge, { props: { tone: "success" }, slots: { default: "Ready" } }).classes()).toContain("ui-badge--success");
    expect(mount(UiStatus, { props: { tone: "danger" }, slots: { default: "Error" } }).classes()).toContain("ui-status--danger");
    expect(mount(UiEmptyState, { props: { message: "No items" } }).text()).toBe("No items");
  });

  it("renders segmented controls and emits selected values", async () => {
    const segmented = mount(UiSegmentedControl, {
      props: {
        modelValue: "system",
        label: "Theme",
        options: [
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" }
        ]
      }
    });

    expect(segmented.attributes("role")).toBe("radiogroup");
    expect(segmented.find('[aria-checked="true"]').text()).toBe("System");
    await segmented.findAll("button")[1]?.trigger("click");
    expect(segmented.emitted("update:modelValue")?.[0]).toEqual(["light"]);
  });

  it("moves segmented-control focus with keyboard selection", async () => {
    const segmented = mount(UiSegmentedControl, {
      attachTo: document.body,
      props: {
        modelValue: "system",
        label: "Theme",
        options: [
          { value: "system", label: "System" },
          { value: "light", label: "Light", disabled: true },
          { value: "dark", label: "Dark" }
        ]
      }
    });

    const buttons = segmented.findAll<HTMLButtonElement>("button");
    buttons[0]!.element.focus();

    await buttons[0]!.trigger("keydown", { key: "ArrowRight" });
    await nextTick();

    expect(segmented.emitted("update:modelValue")?.[0]).toEqual(["dark"]);
    expect(document.activeElement).toBe(buttons[2]!.element);
    expect(buttons[0]!.attributes("tabindex")).toBe("-1");
    expect(buttons[2]!.attributes("tabindex")).toBe("0");

    segmented.unmount();
  });

  it("uses the selected segmented-control item as the initial tab stop", () => {
    const segmented = mount(UiSegmentedControl, {
      props: {
        modelValue: "dark",
        label: "Theme",
        options: [
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" }
        ]
      }
    });

    const buttons = segmented.findAll<HTMLButtonElement>("button");

    expect(buttons[0]!.attributes("tabindex")).toBe("-1");
    expect(buttons[2]!.attributes("tabindex")).toBe("0");
  });

  it("renders progress with an accessible numeric value", () => {
    const progress = mount(UiProgress, {
      props: { value: 42, label: "Download progress" }
    });

    expect(progress.attributes("role")).toBe("progressbar");
    expect(progress.attributes("aria-valuenow")).toBe("42");
    expect(progress.get(".ui-progress__bar").attributes("style")).toContain("42%");
  });
});
