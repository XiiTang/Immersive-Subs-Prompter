import { describe, expect, it } from "vitest";
import { parseSubtitle } from "./subtitleParser.js";

describe("subtitleParser", () => {
  describe("parseSubtitle (srt)", () => {
    it("parses a basic SRT file", () => {
      const srt = [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "Hello",
        "",
        "2",
        "00:00:03,000 --> 00:00:04,500",
        "World",
        ""
      ].join("\n");
      const cues = parseSubtitle(srt, "srt");
      expect(cues).toHaveLength(2);
      expect(cues[0]).toMatchObject({ start: 1000, end: 2000, text: "Hello" });
      expect(cues[1]).toMatchObject({ start: 3000, end: 4500, text: "World" });
    });

    it("strips the BOM from UTF-8 SRT content", () => {
      const srt =
        "\ufeff1\n00:00:01,000 --> 00:00:02,000\nHello\n";
      const cues = parseSubtitle(srt, "srt");
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe("Hello");
    });

    it("sanitizes html entities and basic tags", () => {
      const srt = [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "<b>Hello</b>&nbsp;<i>world</i>",
        ""
      ].join("\n");
      const cues = parseSubtitle(srt, "srt");
      expect(cues[0].text).toBe("Hello world");
    });
  });

  describe("parseSubtitle (vtt)", () => {
    it("parses basic WEBVTT content", () => {
      const vtt = [
        "WEBVTT",
        "",
        "00:00:01.000 --> 00:00:02.000",
        "Line one",
        "",
        "00:00:03.000 --> 00:00:04.000",
        "Line two",
        ""
      ].join("\n");
      const cues = parseSubtitle(vtt, "vtt");
      expect(cues).toHaveLength(2);
      expect(cues[0]).toMatchObject({ start: 1000, end: 2000, text: "Line one" });
    });

    it("skips NOTE blocks", () => {
      const vtt = [
        "WEBVTT",
        "",
        "NOTE this is ignored",
        "",
        "00:00:01.000 --> 00:00:02.000",
        "Hello",
        ""
      ].join("\n");
      const cues = parseSubtitle(vtt, "vtt");
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe("Hello");
    });

    it("rejects unsupported subtitle extensions", () => {
      const vtt = [
        "WEBVTT",
        "",
        "00:00:01.000 --> 00:00:02.000",
        "Hi",
        ""
      ].join("\n");
      expect(() => parseSubtitle(vtt, "unknown")).toThrow(
        "Unsupported subtitle extension: unknown"
      );
    });
  });
});
