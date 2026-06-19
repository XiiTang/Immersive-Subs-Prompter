import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener<T> = (message: T) => void;

class FakePort {
  readonly postMessage = vi.fn((message: unknown) => {
    if (this.disconnected) {
      throw new Error("Port is disconnected");
    }
    this.messages.push(message);
  });
  readonly messages: unknown[] = [];
  private disconnected = false;
  private readonly messageListeners: Array<Listener<unknown>> = [];
  private readonly disconnectListeners: Array<Listener<void>> = [];

  readonly onMessage = {
    addListener: (listener: Listener<unknown>) => {
      this.messageListeners.push(listener);
    }
  };

  readonly onDisconnect = {
    addListener: (listener: Listener<void>) => {
      this.disconnectListeners.push(listener);
    }
  };

  emitMessage(message: unknown) {
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }

  disconnect() {
    this.disconnected = true;
    for (const listener of this.disconnectListeners) {
      listener();
    }
  }
}

function mountPopupDom() {
  document.body.innerHTML = `
    <span id="status-indicator"></span>
    <button id="settings-btn" type="button"></button>
    <button id="settings-back" type="button"></button>
    <section id="media-root"></section>
    <section id="settings-panel"></section>
    <span id="server-summary"></span>
    <section id="server-root"></section>
    <div id="blacklist-list"></div>
    <div id="blacklist-draft-error"></div>
    <template id="media-row-template">
      <article>
        <div class="media-row__header">
          <div class="media-row__title"></div>
          <span class="media-row__status"></span>
        </div>
        <div class="media-row__subtitle"></div>
        <div class="media-row__meta"></div>
        <div class="media-row__progress-bar"></div>
        <div class="media-row__time"></div>
        <a class="media-row__link"></a>
      </article>
    </template>
  `;
}

async function loadPopup(connect: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  vi.stubGlobal("chrome", {
    i18n: {
      getMessage: vi.fn(() => ""),
      getUILanguage: vi.fn(() => "en")
    },
    runtime: {
      connect
    },
    storage: {
      local: {
        get: vi.fn((_: unknown, callback: (result: Record<string, unknown>) => void) => callback({})),
        set: vi.fn()
      }
    }
  });
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })));
  await import("./popup");
}

describe("popup server settings", () => {
  beforeEach(() => {
    mountPopupDom();
  });

  it("renders observed connection rows even when the endpoint list is empty", async () => {
    const port = new FakePort();
    await loadPopup(vi.fn(() => port));

    port.emitMessage({
      type: "media-state-snapshot",
      payload: {
        generatedAt: Date.now(),
        items: [],
        endpoints: [],
        connections: [
          {
            endpoint: "ws://127.0.0.1:44501/?token=0123456789abcdef0123456789abcdef",
            state: "connected",
            lastError: null,
            lastChangeAt: Date.now()
          }
        ]
      }
    });

    expect(document.querySelector(".server-endpoint")?.textContent).toBe(
      "ws://127.0.0.1:44501/?token=0123456789abcdef0123456789abcdef"
    );
    expect(document.getElementById("server-summary")?.textContent).toBe("1/1 connected");
  });

  it("reconnects the dashboard port before adding an endpoint after disconnect", async () => {
    const firstPort = new FakePort();
    const secondPort = new FakePort();
    await loadPopup(vi.fn()
      .mockReturnValueOnce(firstPort)
      .mockReturnValueOnce(secondPort));

    firstPort.disconnect();
    const input = document.querySelector<HTMLInputElement>('[data-testid="server-draft-input"]');
    expect(input).not.toBeNull();
    input!.value = "ws://127.0.0.1:44501/?token=0123456789abcdef0123456789abcdef";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(secondPort.postMessage).toHaveBeenCalledWith({
      type: "server-endpoints:add",
      endpoint: "ws://127.0.0.1:44501/?token=0123456789abcdef0123456789abcdef"
    });
  });
});
