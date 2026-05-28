import { describe, expect, it } from "vitest";
import { isUrlBlacklisted } from "./URLMatcher";

describe("extension blacklist URL matching", () => {
  it("uses profile URL rule semantics for blacklist rules", () => {
    const rules = [
      { id: "domain", value: "youtube.com" },
      { id: "glob", value: "*.site.com/path/*" },
      { id: "exact", value: "=https://example.com/exact" },
      { id: "regex", value: "re:^https://videos\\.example\\.com/watch/\\d+$" },
      { id: "contains", value: "contains:special-video" }
    ];

    expect(isUrlBlacklisted("https://music.youtube.com/watch?v=1", rules)).toBe(true);
    expect(isUrlBlacklisted("https://notyoutube.com/watch?next=youtube.com", rules)).toBe(false);
    expect(isUrlBlacklisted("https://video.site.com/path/watch", rules)).toBe(true);
    expect(isUrlBlacklisted("https://example.com/exact?x=1", rules)).toBe(false);
    expect(isUrlBlacklisted("https://videos.example.com/watch/42", rules)).toBe(true);
    expect(isUrlBlacklisted("https://example.com/SPECIAL-VIDEO", rules)).toBe(true);
  });
});
