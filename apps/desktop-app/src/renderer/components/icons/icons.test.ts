import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { IconAdd, IconClose, IconDelete, IconPlay, IconSettings } from "./index";

describe("lucide-backed local icons", () => {
  it("keeps the local icon API while rendering lucide svg output", () => {
    for (const Icon of [IconAdd, IconClose, IconDelete, IconPlay, IconSettings]) {
      const wrapper = mount(Icon, { props: { size: "md" } });
      const svg = wrapper.get("svg");

      expect(svg.attributes("aria-hidden")).toBe("true");
      expect(svg.classes()).toContain("icon");
      expect(svg.classes()).toContain("icon--md");
      expect(svg.attributes("width")).toBe("16");
      expect(svg.attributes("height")).toBe("16");
    }
  });
});
