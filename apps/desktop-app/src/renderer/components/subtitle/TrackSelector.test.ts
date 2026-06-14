import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import TrackSelector from "./TrackSelector.vue";

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

async function openSelect(trigger: HTMLElement) {
  trigger.dispatchEvent(
    createPointerEvent("pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse"
    })
  );
  await nextTick();
}

async function selectOpenOption(value: string) {
  const option = Array.from(document.body.querySelectorAll<HTMLElement>("[data-value]"))
    .find((element) => element.dataset.value === value);
  expect(option).toBeInstanceOf(HTMLElement);
  option!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await nextTick();
  await nextTick();
}

describe("TrackSelector", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("maps local select options to subtitle track ids and the empty track value", async () => {
    const wrapper = mount(TrackSelector, {
      attachTo: document.body,
      props: {
        modelValue: "",
        tracks: [
          { id: "track-en", sourceFile: "english.vtt" },
          { id: "track-zh", sourceFile: "chinese.vtt" }
        ],
        leadLabel: "Primary",
        noneLabel: "None",
        ariaLabel: "Primary subtitle",
        formatSourceFile: (sourceFile: string) => sourceFile.replace(".vtt", "")
      }
    });

    const trigger = wrapper.get<HTMLElement>('[role="combobox"]');
    expect(trigger.text()).toContain("None");

    trigger.element.dispatchEvent(
      createPointerEvent("pointerdown", {
        button: 0,
        pointerId: 1,
        pointerType: "mouse"
      })
    );
    await nextTick();

    const leadOption = document.body.querySelector<HTMLButtonElement>('[data-value="__track_selector_lead_label__"]');
    expect(leadOption).toBeInstanceOf(HTMLButtonElement);
    expect(leadOption!.disabled).toBe(true);

    await selectOpenOption("track-zh");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["track-zh"]);

    await wrapper.setProps({ modelValue: "track-zh" });
    await openSelect(trigger.element);
    await selectOpenOption("__track_selector_none__");
    expect(wrapper.emitted("update:modelValue")?.[1]).toEqual([""]);

    wrapper.unmount();
  });
});
