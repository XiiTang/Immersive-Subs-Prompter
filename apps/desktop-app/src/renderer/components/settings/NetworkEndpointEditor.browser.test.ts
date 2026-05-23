import { mount } from "@vue/test-utils";
import { userEvent } from "vitest/browser";
import { beforeEach, describe, expect, it } from "vitest";
import NetworkEndpointEditor from "./NetworkEndpointEditor.vue";
import "../../style.css";

function mountEditor() {
  return mount(NetworkEndpointEditor, {
    attachTo: document.body,
    props: {
      endpoints: [
        { id: "default", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef",
      listenerStatuses: [],
      label: "Listening Endpoints",
      hint: "Add explicit addresses.",
      placeholder: "127.0.0.1:44501",
      removeLabel: "Remove endpoint"
    }
  });
}

function endpointPill(wrapper: ReturnType<typeof mountEditor>, endpointId: string): HTMLElement {
  const display = wrapper.get(`[data-testid="network-endpoint-display-${endpointId}"]`).element;
  const pill = display.closest(".network-endpoint-editor__item");
  if (!(pill instanceof HTMLElement)) {
    throw new Error("Endpoint display is not inside a pill");
  }
  return pill;
}

describe("NetworkEndpointEditor browser layout", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reveals a compact remove control centered on the saved endpoint pill border", async () => {
    const wrapper = mountEditor();
    const pill = endpointPill(wrapper, "default");
    const remove = wrapper.get('[data-testid="network-endpoint-remove-default"]').element as HTMLElement;

    expect(getComputedStyle(remove).opacity).toBe("0");

    await userEvent.hover(pill);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const pillRect = pill.getBoundingClientRect();
    const removeRect = remove.getBoundingClientRect();
    const removeCenterX = removeRect.left + removeRect.width / 2;
    const removeCenterY = removeRect.top + removeRect.height / 2;
    const pillRadius = pillRect.height / 2;
    const cornerCenterX = pillRect.right - pillRadius;
    const cornerCenterY = pillRect.top + pillRadius;
    const distanceToCornerCenter = Math.hypot(removeCenterX - cornerCenterX, removeCenterY - cornerCenterY);

    expect(getComputedStyle(remove).opacity).toBe("1");
    expect(Math.round(removeRect.width)).toBe(12);
    expect(Math.round(removeRect.height)).toBe(12);
    expect(remove.querySelector("svg")).not.toBeNull();
    expect(removeCenterX).toBeLessThan(pillRect.right);
    expect(removeCenterY).toBeGreaterThan(pillRect.top);
    expect(Math.abs(distanceToCornerCenter - pillRadius)).toBeLessThanOrEqual(1.5);
  });

  it("keeps the trailing draft pill the same height as saved endpoint pills", () => {
    const wrapper = mountEditor();
    const savedPill = endpointPill(wrapper, "default");
    const draftPill = wrapper.get(".priority-editor__draft").element as HTMLElement;

    expect(Math.round(draftPill.getBoundingClientRect().height)).toBe(
      Math.round(savedPill.getBoundingClientRect().height)
    );
  });

  it("keeps the trailing draft pill at 45 percent of the previous network draft width", () => {
    const wrapper = mountEditor();
    const draftPill = wrapper.get(".priority-editor__draft").element as HTMLElement;
    const previousDraftWidth = 244;

    expect(Math.round(draftPill.getBoundingClientRect().width)).toBe(Math.round(previousDraftWidth * 0.45));
  });

  it("keeps the draft input borderless inside the trailing pill", () => {
    const wrapper = mountEditor();
    const draftInput = wrapper.get('[data-testid="network-endpoint-draft-input"]').element as HTMLElement;
    const inputStyle = getComputedStyle(draftInput);

    expect(inputStyle.borderTopWidth).toBe("0px");
    expect(inputStyle.borderRightWidth).toBe("0px");
    expect(inputStyle.borderBottomWidth).toBe("0px");
    expect(inputStyle.borderLeftWidth).toBe("0px");
  });
});
