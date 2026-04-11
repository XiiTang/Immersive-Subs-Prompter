import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: () => "/tmp/immersive-subs-prompter"
  }
}));

describe("sanitizeSettings", () => {
  it("ignores flat legacy settings objects instead of upgrading them", async () => {
    const { DEFAULT_SETTINGS, sanitizeSettings } = await import("../../main/settings/appSettingsSanitizer.js");

    const sanitized = sanitizeSettings({
      subtitleFontSize: 42,
      subtitleScrollPosition: 77,
      closeBehavior: "quit",
      language: "en"
    } as any);

    expect(sanitized).toEqual(DEFAULT_SETTINGS);
  });

  it("ignores deprecated jellyfinemby aliases instead of treating them as modern settings", async () => {
    const { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings } = await import("../../main/settings/appSettingsSanitizer.js");

    const sanitized = sanitizeSettings({
      jellyfinemby: {
        enabled: true,
        configs: [
          {
            id: "legacy-server",
            name: "Legacy",
            type: "jellyfinemby",
            serverUrl: "https://example.com",
            apiKey: "token",
            webSocketPath: "/socket",
            enabled: true
          }
        ]
      }
    } as any);

    expect(sanitized).toEqual(DEFAULT_SETTINGS);
    expect(
      mergeSettings(DEFAULT_SETTINGS, {
        jellyfinemby: {
          enabled: true
        }
      } as any)
    ).toEqual(DEFAULT_SETTINGS);
  });
});
