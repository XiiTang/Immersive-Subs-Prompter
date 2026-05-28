import { describe, expect, it } from "vitest";
import { getUrlRuleMatchType, matchesUrlRule, parseUrlRulePattern } from "./index.js";

describe("URL rule matcher", () => {
  it("matches plain domains against URL hosts only", () => {
    expect(matchesUrlRule("https://music.youtube.com/watch?v=1", "youtube.com")).toBe(true);
    expect(matchesUrlRule("https://notyoutube.com/watch?next=youtube.com", "youtube.com")).toBe(false);
  });

  it("supports smart URL rule prefixes used by desktop profiles and the extension popup", () => {
    expect(matchesUrlRule("https://video.site.com/path/watch?x=1", "*.site.com/path/*")).toBe(true);
    expect(matchesUrlRule("https://video.site.com/other/watch", "*.site.com/path/*")).toBe(false);
    expect(matchesUrlRule("https://example.com/watch", "=https://example.com/watch")).toBe(true);
    expect(matchesUrlRule("https://example.com/watch?x=1", "=https://example.com/watch")).toBe(false);
    expect(matchesUrlRule("https://example.com/watch/123", "re:^https://example\\.com/watch/\\d+$")).toBe(true);
    expect(matchesUrlRule("https://example.com/watch/abc", "re:^https://example\\.com/watch/\\d+$")).toBe(false);
    expect(matchesUrlRule("https://example.com/watch/abc", "contains:WATCH")).toBe(true);
  });

  it("reports rule types for labels and validation", () => {
    expect(getUrlRuleMatchType("youtube.com")).toBe("domain");
    expect(getUrlRuleMatchType("*.site.com/path/*")).toBe("glob");
    expect(getUrlRuleMatchType("=https://example.com/watch")).toBe("exact");
    expect(getUrlRuleMatchType("re:watch/\\d+")).toBe("regex");
    expect(getUrlRuleMatchType("contains:watch")).toBe("contains");
    expect(parseUrlRulePattern("re:[broken").error).toBe("invalid-regex");
  });
});
