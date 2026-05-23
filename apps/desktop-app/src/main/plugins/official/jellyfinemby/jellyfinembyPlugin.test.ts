import { describe, expect, it, vi } from "vitest";
import { JELLYFINEMBY_MANIFEST } from "./manifest.js";
import { registerJellyfinembyPluginMain } from "./registerMain.js";

describe("official Jellyfin / Emby plugin", () => {
  it("declares the bundled plugin manifest", () => {
    expect(JELLYFINEMBY_MANIFEST).toEqual({
      id: "official.jellyfinemby",
      version: "1.0.0",
      displayName: "Jellyfin / Emby",
      description: "Sync playback and subtitles from Jellyfin or Emby media servers.",
      settings: [
        {
          id: "official.jellyfinemby.settings",
          title: "Jellyfin / Emby"
        }
      ]
    });
  });

  it("activates and deactivates the media server controller", () => {
    const controller = {
      activate: vi.fn(),
      deactivate: vi.fn()
    };

    const contribution = registerJellyfinembyPluginMain({ mediaServerController: controller });

    expect(controller.activate).toHaveBeenCalledTimes(1);
    expect(contribution.commands).toEqual({});

    contribution.dispose?.();
    expect(controller.deactivate).toHaveBeenCalledTimes(1);
  });
});
