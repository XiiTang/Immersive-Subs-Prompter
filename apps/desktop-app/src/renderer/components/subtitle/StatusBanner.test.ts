import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StatusBanner from "./StatusBanner.vue";

describe("StatusBanner", () => {
  it("renders status text through the foundation message primitive", () => {
    const wrapper = mount(StatusBanner, {
      props: {
        banner: {
          text: "Timed out",
          tone: "danger"
        }
      }
    });

    expect(wrapper.find('[data-slot="message"]').exists()).toBe(true);
    expect(wrapper.get('[data-slot="message"]').classes()).toContain("ui-message--danger");
    expect(wrapper.text()).toBe("Timed out");
  });

  it("keeps neutral status presentation in the foundation tone system", () => {
    const wrapper = mount(StatusBanner, {
      props: {
        banner: {
          text: "Waiting for media",
          tone: "neutral"
        }
      }
    });

    expect(wrapper.get('[data-slot="message"]').classes()).toContain("ui-message--neutral");
  });
});
