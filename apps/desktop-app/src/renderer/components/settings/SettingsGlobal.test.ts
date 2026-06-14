import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../main/types";
import SettingsGlobal from "./SettingsGlobal.vue";
import { useDesktopStore } from "../../stores/desktop";

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

async function selectOption(trigger: HTMLElement, value: string) {
  trigger.dispatchEvent(
    createPointerEvent("pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse"
    })
  );
  await nextTick();

  const option = Array.from(document.body.querySelectorAll<HTMLElement>("[data-value]"))
    .find((element) => element.dataset.value === value);
  expect(option).toBeInstanceOf(HTMLElement);
  option!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await nextTick();
  await nextTick();
}

function createSettings(): AppSettings {
  return {
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "CommandOrControl+Shift+S",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: { theme: "system" },
      autoCheckUpdates: true,
      lastUpdateCheckAt: null
    },
    network: {
      endpoints: [
        { id: "default", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    },
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {},
    cache: {
      enabled: true,
      path: "",
      retentionDays: 30
    }
  };
}

describe("SettingsGlobal", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
  });

  it("organizes global settings into compact setting groups", () => {
    const store = useDesktopStore();
    store.settings = createSettings();

    const wrapper = mount(SettingsGlobal);
    const groups = wrapper.findAll(".global-settings__group");

    expect(wrapper.text()).toContain("Global");
    expect(groups.map((group) => group.get(".global-settings__group-title").text())).toEqual([
      "General",
      "Updates",
      "Network",
      "Shortcuts",
      "Cache"
    ]);
    const shortcutsGroup = groups.find((group) => group.get(".global-settings__group-title").text() === "Shortcuts");
    expect(shortcutsGroup?.text()).toContain("Toggle Shortcut");
    expect(shortcutsGroup?.text()).toContain("Blocked Processes");
    expect(wrapper.findAll('[data-slot="setting-row"]').length).toBeGreaterThanOrEqual(8);
    expect(wrapper.get("#language-label").element.closest('[data-slot="setting-row"]')).not.toBeNull();
    expect(wrapper.get("#language-label").element.closest('[data-slot="setting-row"]')?.querySelector(".ui-select")).not.toBeNull();
    expect(wrapper.find("#appearance-theme-label").exists()).toBe(true);
    expect(wrapper.find("#cache-path-label").exists()).toBe(true);
    expect(wrapper.text()).toContain("Endpoints");
    expect(wrapper.text()).toContain("Path");
    expect(wrapper.text()).toContain("Stats");
  });

  it("lets setting rows provide field ARIA without duplicate ids", () => {
    const store = useDesktopStore();
    store.settings = createSettings();

    const wrapper = mount(SettingsGlobal);

    expect(ariaIds(wrapper.get('[data-testid="toggle-shortcut-input"]').attributes("aria-describedby"))).toEqual([
      "toggle-shortcut-hint"
    ]);
    expect(ariaIds(wrapper.get('input[aria-labelledby="cache-path-label"]').attributes("aria-describedby"))).toEqual([
      "cache-path-hint"
    ]);
    expect(ariaIds(wrapper.get('input[aria-labelledby="cache-retention-label"]').attributes("aria-describedby"))).toEqual([]);
  });

  it("renders endpoint pills as extension URLs", () => {
    const store = useDesktopStore();
    store.settings = createSettings();

    const wrapper = mount(SettingsGlobal);

    expect(wrapper.text()).toContain("ws://127.0.0.1:44501/");
    expect(wrapper.text()).toContain("ws://192.168.1.2:44502/?token=0123456789abcdef0123456789abcdef");
  });

  it("updates language, theme, auto-launch, and cache through local UI primitives", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    const updateGlobalSpy = vi.spyOn(store, "updateGlobalSetting").mockImplementation((key, value) => {
      if (!store.settings) {
        return;
      }
      store.settings.global = {
        ...store.settings.global,
        [key]: value
      };
    });
    const updateCacheSpy = vi.spyOn(store, "updateCacheSetting").mockImplementation((key, value) => {
      if (!store.settings) {
        return;
      }
      store.settings.cache = {
        ...store.settings.cache,
        [key]: value
      };
    });

    const wrapper = mount(SettingsGlobal, { attachTo: document.body });

    await selectOption(wrapper.get<HTMLElement>('[role="combobox"]').element, "zh");
    expect(updateGlobalSpy).toHaveBeenCalledWith("language", "zh");

    await wrapper.get('[role="radiogroup"] [aria-checked="false"]:last-child').trigger("click");
    expect(updateGlobalSpy).toHaveBeenCalledWith("appearance", { theme: "dark" });

    await wrapper.findAll('[role="switch"]')[0]!.trigger("click");
    expect(updateGlobalSpy).toHaveBeenCalledWith("autoLaunch", true);

    const cacheRow = wrapper.get("#cache-enabled-label").element.closest('[data-slot="setting-row"]');
    const cacheSwitch = cacheRow?.querySelector<HTMLElement>('[role="switch"]');
    expect(cacheSwitch).toBeInstanceOf(HTMLElement);
    cacheSwitch!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(updateCacheSpy).toHaveBeenCalledWith("enabled", false);

    wrapper.unmount();
  });

  it("adds a draft endpoint from host:port input", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    const updateSpy = vi.spyOn(store, "updateNetworkSetting").mockImplementation((key, value) => {
      if (store.settings && key === "endpoints") {
        store.settings.network.endpoints = value as never;
      }
    });

    const wrapper = mount(SettingsGlobal);
    const input = wrapper.get<HTMLInputElement>('[data-testid="network-endpoint-draft-input"]');
    await input.setValue("192.168.1.3:44503");
    await input.trigger("keyup.enter");

    expect(updateSpy).toHaveBeenCalledWith("endpoints", [
      { id: "default", host: "127.0.0.1", port: 44501 },
      { id: "lan", host: "192.168.1.2", port: 44502 },
      expect.objectContaining({ host: "192.168.1.3", port: 44503 })
    ]);
  });

  it("rejects duplicate endpoint input", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    const updateSpy = vi.spyOn(store, "updateNetworkSetting").mockImplementation(() => undefined);

    const wrapper = mount(SettingsGlobal);
    const input = wrapper.get<HTMLInputElement>('[data-testid="network-endpoint-draft-input"]');
    await input.setValue("127.0.0.1:44501");
    await input.trigger("keyup.enter");

    expect(wrapper.text()).toContain("Endpoint already exists");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("does not remove the final endpoint", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      network: {
        endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      }
    };
    const updateSpy = vi.spyOn(store, "updateNetworkSetting").mockImplementation(() => undefined);

    const wrapper = mount(SettingsGlobal);
    expect(wrapper.find('[data-testid="network-endpoint-remove-default"]').exists()).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("shows listener errors from desktop state", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = {
      networkListeners: [
        {
          endpointId: "lan",
          host: "192.168.1.2",
          port: 44502,
          status: "error",
          error: "listen EADDRNOTAVAIL"
        }
      ]
    } as never;

    const wrapper = mount(SettingsGlobal);

    expect(wrapper.text()).toContain("192.168.1.2:44502 - listen EADDRNOTAVAIL");
  });

  it("keeps saved endpoint pills read-only", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    const updateSpy = vi.spyOn(store, "updateNetworkSetting").mockImplementation(() => undefined);

    const wrapper = mount(SettingsGlobal);
    await wrapper.get('[data-testid="network-endpoint-display-default"]').trigger("click");
    await nextTick();

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("adds a draft endpoint on blur and displays its extension URL", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    vi.spyOn(store, "updateNetworkSetting").mockImplementation((key, value) => {
      if (store.settings && key === "endpoints") {
        store.settings.network.endpoints = value as never;
      }
    });

    const wrapper = mount(SettingsGlobal);
    const input = wrapper.get<HTMLInputElement>('[data-testid="network-endpoint-draft-input"]');
    await input.setValue("192.168.1.3:44503");
    await input.trigger("blur");

    await nextTick();

    expect(input.element.value).toBe("");
    expect(wrapper.text()).toContain("ws://192.168.1.3:44503/?token=0123456789abcdef0123456789abcdef");
  });

  it("edits the process blacklist as read-only pills with a trailing draft", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      global: {
        ...createSettings().global,
        gameProcessBlacklist: ["r5apex_dx12.exe"]
      }
    };
    const addSpy = vi.spyOn(store, "addGameProcess");
    const removeSpy = vi.spyOn(store, "removeGameProcess");

    const wrapper = mount(SettingsGlobal);

    expect(wrapper.text()).toContain("r5apex_dx12.exe");
    expect(wrapper.find('[data-testid="process-blacklist-draft-input"]').exists()).toBe(true);

    const input = wrapper.get<HTMLInputElement>('[data-testid="process-blacklist-draft-input"]');
    await input.setValue("vlc.exe");
    await input.trigger("blur");

    expect(addSpy).toHaveBeenCalledWith("vlc.exe");

    await wrapper.get('[data-testid="process-blacklist-remove-r5apex_dx12.exe"]').trigger("click");

    expect(removeSpy).toHaveBeenCalledWith("r5apex_dx12.exe");
  });

  it("captures the toggle shortcut from key presses and clears it with Backspace", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    const updateSpy = vi.spyOn(store, "updateGlobalSetting").mockImplementation((key, value) => {
      if (store.settings && key === "toggleWindowShortcut") {
        store.settings.global.toggleWindowShortcut = value as string;
      }
    });

    const wrapper = mount(SettingsGlobal);
    const input = wrapper.get<HTMLInputElement>('[data-testid="toggle-shortcut-input"]');

    await input.trigger("keydown", {
      code: "KeyP",
      key: "p",
      ctrlKey: true,
      altKey: true
    });

    expect(updateSpy).toHaveBeenCalledWith("toggleWindowShortcut", "CommandOrControl+Alt+P");

    await input.trigger("keydown", {
      code: "Backspace",
      key: "Backspace"
    });

    expect(updateSpy).toHaveBeenCalledWith("toggleWindowShortcut", "");
  });
});

function ariaIds(value: string | undefined) {
  return (value ?? "").split(/\s+/).filter(Boolean);
}
