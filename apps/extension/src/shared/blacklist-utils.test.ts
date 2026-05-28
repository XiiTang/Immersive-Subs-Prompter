import { describe, expect, it } from "vitest";
import { areBlacklistRulesEqual, normalizeBlacklistRules } from "./blacklist-utils";

describe("blacklist rule utilities", () => {
  it("normalizes blacklist rules as pattern-only URL rules", () => {
    expect(
      normalizeBlacklistRules([
        { id: "one", value: " youtube.com " },
        { id: "", value: " =https://example.com/watch " },
        { id: "empty", value: " " },
        { id: "bad" },
        null
      ])
    ).toEqual([
      { id: "one", value: "youtube.com" },
      { id: "rule-1", value: "=https://example.com/watch" }
    ]);
  });

  it("compares rules by id and value only", () => {
    expect(areBlacklistRulesEqual([{ id: "one", value: "youtube.com" }], [{ id: "one", value: "youtube.com" }])).toBe(
      true
    );
    expect(
      areBlacklistRulesEqual([{ id: "one", value: "youtube.com" }], [{ id: "one", value: "contains:youtube.com" }])
    ).toBe(false);
  });
});
