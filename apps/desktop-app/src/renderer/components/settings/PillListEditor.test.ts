import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import PillListEditor from "./PillListEditor.vue";

function mountEditor() {
  return mount(PillListEditor, {
    props: {
      label: "Items",
      hint: "Add items",
      items: [
        { id: "one", label: "one.exe" },
        { id: "two", label: "two.exe" }
      ],
      draftValue: "",
      placeholder: "item.exe",
      removeLabel: "Remove item",
      draftTestId: "pill-draft-input",
      displayTestIdPrefix: "pill-display",
      removeTestIdPrefix: "pill-remove"
    }
  });
}

describe("PillListEditor", () => {
  it("renders read-only saved pills and a trailing draft input", () => {
    const wrapper = mountEditor();

    expect(wrapper.text()).toContain("one.exe");
    expect(wrapper.text()).toContain("two.exe");
    expect(wrapper.find('[data-testid="pill-display-one"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pill-draft-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pill-edit-one"]').exists()).toBe(false);
  });

  it("emits draft updates and add-draft on enter and blur", async () => {
    const wrapper = mountEditor();
    const input = wrapper.get<HTMLInputElement>('[data-testid="pill-draft-input"]');

    await input.setValue("three.exe");
    await input.trigger("keyup.enter");
    await input.trigger("blur");

    expect(wrapper.emitted("update:draftValue")).toEqual([["three.exe"]]);
    expect(wrapper.emitted("add-draft")).toHaveLength(2);
  });

  it("emits remove from the close button", async () => {
    const wrapper = mountEditor();

    await wrapper.get('[data-testid="pill-remove-one"]').trigger("click");

    expect(wrapper.emitted("remove")).toEqual([["one"]]);
  });

  it("emits reorder for same-list drag sorting", async () => {
    const wrapper = mount(PillListEditor, {
      props: {
        label: "Items",
        items: [
          { id: "one", label: "one" },
          { id: "two", label: "two" },
          { id: "three", label: "three" }
        ],
        draftValue: "",
        placeholder: "item",
        removeLabel: "Remove item",
        draftTestId: "pill-draft-input",
        displayTestIdPrefix: "pill-display",
        removeTestIdPrefix: "pill-remove",
        sortable: true
      }
    });
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

    await wrapper.get('[data-testid="pill-display-one"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="pill-display-three"]').trigger("dragenter");
    await wrapper.get('[data-testid="pill-display-three"]').trigger("drop");
    await wrapper.get('[data-testid="pill-display-one"]').trigger("dragend");

    expect(wrapper.emitted("reorder")).toEqual([[0, 2]]);
    expect(wrapper.emitted("remove")).toBeUndefined();
  });

  it("ignores drag end and invalid drops without removing items", async () => {
    const wrapper = mount(PillListEditor, {
      props: {
        label: "Items",
        items: [
          { id: "one", label: "one" },
          { id: "two", label: "two" }
        ],
        draftValue: "",
        placeholder: "item",
        removeLabel: "Remove item",
        draftTestId: "pill-draft-input",
        displayTestIdPrefix: "pill-display",
        removeTestIdPrefix: "pill-remove",
        sortable: true
      }
    });
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

    await wrapper.get('[data-testid="pill-display-one"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="pill-display-one"]').trigger("dragend");

    expect(wrapper.emitted("reorder")).toBeUndefined();
    expect(wrapper.emitted("remove")).toBeUndefined();
  });
});
