import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import NetworkEndpointEditor from "./NetworkEndpointEditor.vue";
import "../../style.css";

describe("NetworkEndpointEditor browser layout", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("marks listener error endpoints on the shared pill item", () => {
    const wrapper = mount(NetworkEndpointEditor, {
      attachTo: document.body,
      props: {
        endpoints: [
          { id: "default", host: "127.0.0.1", port: 44501 },
          { id: "lan", host: "192.168.1.2", port: 44502 }
        ],
        authToken: "0123456789abcdef0123456789abcdef",
        listenerStatuses: [
          {
            endpointId: "lan",
            host: "192.168.1.2",
            port: 44502,
            status: "error",
            error: "listen EADDRNOTAVAIL"
          }
        ],
        label: "Listening Endpoints",
        hint: "Add explicit addresses.",
        placeholder: "127.0.0.1:44501",
        removeLabel: "Remove endpoint"
      }
    });

    const lanPill = wrapper
      .get('[data-testid="network-endpoint-display-lan"]')
      .element.closest(".pill-list-editor__item");

    expect(lanPill?.classList.contains("pill-list-editor__item--error")).toBe(true);
    expect(wrapper.text()).toContain("192.168.1.2:44502 - listen EADDRNOTAVAIL");
  });
});
