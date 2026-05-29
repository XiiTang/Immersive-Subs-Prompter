import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { describe, expect, it } from "vitest";
import {
  UiBadge,
  UiButton,
  UiColorInput,
  UiCheckIndicator,
  UiEmptyState,
  UiField,
  UiIconButton,
  UiInput,
  UiListItem,
  UiProgress,
  UiSection,
  UiSelect,
  UiSegmentedControl,
  UiSlider,
  UiStatus,
  UiSwitch,
  UiTextarea,
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

    const colorAreaRoot = colorInput.findComponent({ name: "ColorAreaRoot" });
    expect(colorAreaRoot.exists()).toBe(true);
    colorAreaRoot.vm.$emit("update:modelValue", "#ffffff");
    await nextTick();
    expect(colorInput.emitted("update:modelValue")?.[0]).toEqual(["#ffffff"]);
    colorAreaRoot.vm.$emit("changeEnd", "#ffffff");
    await nextTick();
    expect(colorInput.emitted("update:modelValue")).toHaveLength(1);
    expect(colorInput.emitted("change")?.[0]).toEqual(["#ffffff"]);

    const redField = palette?.querySelector('[data-testid="color-channel-red"]');
    (redField as HTMLInputElement).value = "68";
    redField?.dispatchEvent(new Event("input", { bubbles: true }));
    redField?.dispatchEvent(new Event("blur", { bubbles: true }));
    await nextTick();

    expect(colorInput.emitted("update:modelValue")?.[1]).toEqual(["#44ffff"]);
    expect(colorInput.emitted("change")?.[1]).toEqual(["#44ffff"]);

    (paletteField as HTMLInputElement).value = "#445566";
    paletteField?.dispatchEvent(new Event("input", { bubbles: true }));
    paletteField?.dispatchEvent(new Event("blur", { bubbles: true }));
    await nextTick();

    expect(colorInput.emitted("update:modelValue")?.[2]).toEqual(["#445566"]);
    expect(colorInput.emitted("change")?.[2]).toEqual(["#445566"]);

    colorInput.unmount();
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

  it("renders tooltip primitives with stable slots", () => {
    const tooltip = mount(UiTooltip, {
      props: { text: "Refresh cache" },
      slots: { default: "<button>Refresh</button>" },
      attachTo: document.body
    });

    expect(tooltip.get("button").text()).toBe("Refresh");
  });

  it("renders section, list item, badge, status, check indicator, and empty state classes", () => {
    expect(mount(UiSection, { props: { title: "General" } }).classes()).toContain("ui-section");
    expect(mount(UiListItem, { props: { selected: true } }).classes()).toContain("is-selected");
    expect(mount(UiBadge, { props: { tone: "success" }, slots: { default: "Ready" } }).classes()).toContain("ui-badge--success");
    expect(mount(UiStatus, { props: { tone: "danger" }, slots: { default: "Error" } }).classes()).toContain("ui-status--danger");
    const indicator = mount(UiCheckIndicator, { props: { checked: true, label: "Enabled" } });
    expect(indicator.classes()).toContain("ui-check-indicator");
    expect(indicator.classes()).toContain("ui-check-indicator--sm");
    expect(indicator.attributes("data-state")).toBe("checked");
    expect(indicator.get(".ui-check-indicator__check").exists()).toBe(true);
    expect(mount(UiEmptyState, { props: { message: "No items" } }).text()).toBe("No items");
  });

  it("emits check indicator state changes from the circular control", async () => {
    const indicator = mount(UiCheckIndicator, { props: { checked: false, label: "Enable" } });

    await indicator.trigger("click");

    expect(indicator.emitted("update:checked")?.[0]).toEqual([true]);
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

  it("renders progress with an accessible numeric value", () => {
    const progress = mount(UiProgress, {
      props: { value: 42, label: "Download progress" }
    });

    expect(progress.attributes("role")).toBe("progressbar");
    expect(progress.attributes("aria-valuenow")).toBe("42");
    expect(progress.get(".ui-progress__bar").attributes("style")).toContain("42%");
  });
});
