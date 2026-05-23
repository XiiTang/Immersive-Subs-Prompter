import { mount } from "@vue/test-utils";
import { userEvent } from "vitest/browser";
import { beforeEach, describe, expect, it } from "vitest";
import PillListEditor from "./PillListEditor.vue";
import "../../style.css";

function mountEditor(placeholder = "item.exe") {
  return mount(PillListEditor, {
    attachTo: document.body,
    props: {
      label: "Items",
      hint: "Add items",
      items: [
        { id: "one", label: "one.exe" },
        { id: "two", label: "two.exe" }
      ],
      draftValue: "",
      placeholder,
      removeLabel: "Remove item",
      draftTestId: "pill-draft-input",
      displayTestIdPrefix: "pill-display",
      removeTestIdPrefix: "pill-remove"
    }
  });
}

describe("PillListEditor browser layout", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("uses compact borderless draft input and close button geometry", async () => {
    const wrapper = mountEditor();
    const savedPill = wrapper.get('[data-testid="pill-display-one"]').element.closest(".pill-list-editor__item") as HTMLElement;
    const draftPill = wrapper.get(".pill-list-editor__draft").element as HTMLElement;
    const draftInput = wrapper.get('[data-testid="pill-draft-input"]').element as HTMLElement;
    const remove = wrapper.get('[data-testid="pill-remove-one"]').element as HTMLElement;

    await userEvent.hover(savedPill);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const pillRect = savedPill.getBoundingClientRect();
    const removeRect = remove.getBoundingClientRect();
    const removeCenterX = removeRect.left + removeRect.width / 2;
    const removeCenterY = removeRect.top + removeRect.height / 2;
    const pillRadius = pillRect.height / 2;
    const cornerCenterX = pillRect.right - pillRadius;
    const cornerCenterY = pillRect.top + pillRadius;
    const distanceToCornerCenter = Math.hypot(removeCenterX - cornerCenterX, removeCenterY - cornerCenterY);
    const inputStyle = getComputedStyle(draftInput);

    expect(Math.round(draftPill.getBoundingClientRect().height)).toBe(Math.round(pillRect.height));
    expect(inputStyle.borderTopWidth).toBe("0px");
    expect(inputStyle.borderRightWidth).toBe("0px");
    expect(inputStyle.borderBottomWidth).toBe("0px");
    expect(inputStyle.borderLeftWidth).toBe("0px");
    expect(getComputedStyle(remove).opacity).toBe("1");
    expect(Math.round(removeRect.width)).toBe(12);
    expect(Math.round(removeRect.height)).toBe(12);
    expect(remove.querySelector("svg")).not.toBeNull();
    expect(removeCenterX).toBeLessThan(pillRect.right);
    expect(removeCenterY).toBeGreaterThan(pillRect.top);
    expect(Math.abs(distanceToCornerCenter - pillRadius)).toBeLessThanOrEqual(1.5);
  });

  it("keeps removable saved pill padding balanced while the close button floats", () => {
    const wrapper = mountEditor();
    const savedPill = wrapper.get('[data-testid="pill-display-one"]').element.closest(".pill-list-editor__item") as HTMLElement;
    const savedPillStyle = getComputedStyle(savedPill);

    expect(savedPillStyle.paddingLeft).toBe(savedPillStyle.paddingRight);
  });

  it("sizes the trailing draft pill from its placeholder text", () => {
    const shortWrapper = mountEditor("x");
    const shortDraft = shortWrapper.get(".pill-list-editor__draft").element as HTMLElement;
    const shortWidth = shortDraft.getBoundingClientRect().width;

    document.body.innerHTML = "";

    const longWrapper = mountEditor("192.168.1.2:44501");
    const longDraft = longWrapper.get(".pill-list-editor__draft").element as HTMLElement;
    const longWidth = longDraft.getBoundingClientRect().width;

    expect(longWidth).toBeGreaterThan(shortWidth + 60);
  });
});
