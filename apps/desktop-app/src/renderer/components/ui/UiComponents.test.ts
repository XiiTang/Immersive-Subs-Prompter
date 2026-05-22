import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import {
  UiBadge,
  UiButton,
  UiEmptyState,
  UiField,
  UiIconButton,
  UiInput,
  UiListItem,
  UiPopover,
  UiProgress,
  UiSection,
  UiSelect,
  UiSegmentedControl,
  UiSeparator,
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
    expect(wrapper.get(".ui-field__control").attributes("aria-describedby")).toContain("api-key-hint");
    expect(wrapper.get(".ui-field__control").attributes("aria-describedby")).toContain("api-key-error");
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
    await input.setValue("42");

    expect(slider.emitted("update:modelValue")?.[0]).toEqual([42]);
    expect(slider.emitted("input")?.[0]?.[0]).toBeInstanceOf(Event);
  });

  it("renders tooltip, popover, and separator primitives with stable slots", async () => {
    const tooltip = mount(UiTooltip, {
      props: { text: "Refresh cache" },
      slots: { default: "<button>Refresh</button>" },
      attachTo: document.body
    });

    expect(tooltip.get("button").text()).toBe("Refresh");

    const popover = mount(UiPopover, {
      props: { label: "More actions" },
      slots: {
        trigger: "<button>More</button>",
        default: "<p>Action list</p>"
      },
      attachTo: document.body
    });

    await popover.get("button").trigger("click");
    expect(document.body.textContent).toContain("Action list");

    const separator = mount(UiSeparator);
    expect(separator.attributes("role")).toBe("separator");
    expect(separator.classes()).toContain("ui-separator");
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

  it("renders progress with an accessible numeric value", () => {
    const progress = mount(UiProgress, {
      props: { value: 42, label: "Download progress" }
    });

    expect(progress.attributes("role")).toBe("progressbar");
    expect(progress.attributes("aria-valuenow")).toBe("42");
    expect(progress.get(".ui-progress__bar").attributes("style")).toContain("42%");
  });
});
