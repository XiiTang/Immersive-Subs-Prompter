import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ShortcutInput from "./ShortcutInput.vue";

describe("ShortcutInput", () => {
  it("captures modifier key combinations as Electron accelerators", async () => {
    const wrapper = mount(ShortcutInput, {
      props: {
        modelValue: "",
        placeholder: "Press shortcut"
      }
    });

    await wrapper.get("input").trigger("keydown", {
      code: "KeyS",
      key: "s",
      ctrlKey: true,
      shiftKey: true
    });

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["CommandOrControl+Shift+S"]);
  });

  it("captures space and alt combinations", async () => {
    const wrapper = mount(ShortcutInput, {
      props: {
        modelValue: "",
        placeholder: "Press shortcut"
      }
    });

    await wrapper.get("input").trigger("keydown", {
      code: "Space",
      key: " ",
      metaKey: true,
      altKey: true
    });

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["CommandOrControl+Alt+Space"]);
  });

  it("ignores modifier-only key presses", async () => {
    const wrapper = mount(ShortcutInput, {
      props: {
        modelValue: "CommandOrControl+Shift+S",
        placeholder: "Press shortcut"
      }
    });

    await wrapper.get("input").trigger("keydown", {
      code: "ShiftLeft",
      key: "Shift",
      shiftKey: true
    });

    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("clears the shortcut with bare Backspace or Delete", async () => {
    const wrapper = mount(ShortcutInput, {
      props: {
        modelValue: "CommandOrControl+Shift+S",
        placeholder: "Press shortcut"
      }
    });

    await wrapper.get("input").trigger("keydown", {
      code: "Backspace",
      key: "Backspace"
    });

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([""]);
  });
});
