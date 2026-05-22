import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import {
  UiBadge,
  UiButton,
  UiEmptyState,
  UiField,
  UiIconButton,
  UiInput,
  UiListItem,
  UiSection,
  UiSelect,
  UiStatus,
  UiSwitch,
  UiTextarea
} from "./index";

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
        options: [
          { value: "system", label: "System" },
          { value: "dark", label: "Dark" }
        ]
      }
    });
    await select.get("select").setValue("system");
    expect(select.emitted("update:modelValue")?.[0]).toEqual(["system"]);

    const toggle = mount(UiSwitch, { props: { modelValue: false, label: "On" } });
    await toggle.get("input").setValue(true);
    expect(toggle.emitted("update:modelValue")?.[0]).toEqual([true]);
  });

  it("renders section, list item, badge, status, and empty state classes", () => {
    expect(mount(UiSection, { props: { title: "General" } }).classes()).toContain("ui-section");
    expect(mount(UiListItem, { props: { selected: true } }).classes()).toContain("is-selected");
    expect(mount(UiBadge, { props: { tone: "success" }, slots: { default: "Ready" } }).classes()).toContain("ui-badge--success");
    expect(mount(UiStatus, { props: { tone: "danger" }, slots: { default: "Error" } }).classes()).toContain("ui-status--danger");
    expect(mount(UiEmptyState, { props: { message: "No items" } }).text()).toBe("No items");
  });
});
