import { describe, expect, it } from "vitest";
import { decodePluginSettingsSectionKey, encodePluginSettingsSectionKey } from "./pluginSettingsSectionKey";

describe("pluginSettingsSectionKey", () => {
  it("encodes and decodes plugin settings navigation keys", () => {
    const key = encodePluginSettingsSectionKey("xiitang/word-lookup", "word-lookup.settings");

    expect(key).toBe("xiitang/word-lookup::word-lookup.settings");
    expect(decodePluginSettingsSectionKey(key)).toEqual({
      pluginKey: "xiitang/word-lookup",
      sectionId: "word-lookup.settings"
    });
  });
});
