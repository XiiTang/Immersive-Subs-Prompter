import { describe, expect, it } from "vitest";
import { parseSubtitle } from "./subtitleParser.js";
import {
  DEFAULT_SUBTITLE_PARSER_LIMITS,
  MAX_SUBTITLE_CUE_COUNT,
  MAX_SUBTITLE_LINE_COUNT,
  MAX_SUBTITLE_TEXT_BYTES
} from "./resourceLimits.js";

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

  describe("parseSubtitle limits", () => {
    it("exports broad final parser limits", () => {
      expect(MAX_SUBTITLE_TEXT_BYTES).toBe(100 * 1024 * 1024);
      expect(MAX_SUBTITLE_LINE_COUNT).toBe(1_000_000);
      expect(MAX_SUBTITLE_CUE_COUNT).toBe(1_000_000);
      expect(DEFAULT_SUBTITLE_PARSER_LIMITS).toEqual({
        maxInputBytes: MAX_SUBTITLE_TEXT_BYTES,
        maxLineCount: MAX_SUBTITLE_LINE_COUNT,
        maxCueCount: MAX_SUBTITLE_CUE_COUNT
      });
    });

    it("rejects direct subtitle input above the configured byte limit", () => {
      expect(() =>
        parseSubtitle("123456", "srt", {
          maxInputBytes: 5,
          maxLineCount: MAX_SUBTITLE_LINE_COUNT,
          maxCueCount: MAX_SUBTITLE_CUE_COUNT
        })
      ).toThrow("Subtitle parser input exceeds 5 bytes.");
    });

    it("rejects direct subtitle input above the configured line cap", () => {
      expect(() =>
        parseSubtitle("a\nb\nc", "srt", {
          maxInputBytes: MAX_SUBTITLE_TEXT_BYTES,
          maxLineCount: 2,
          maxCueCount: MAX_SUBTITLE_CUE_COUNT
        })
      ).toThrow("Subtitle parser input exceeds 2 lines.");
    });

    it("rejects direct subtitle input above the configured cue cap", () => {
      const srt = [
        "1",
        "00:00:00,000 --> 00:00:01,000",
        "One",
        "",
        "2",
        "00:00:01,000 --> 00:00:02,000",
        "Two",
        ""
      ].join("\n");

      expect(() =>
        parseSubtitle(srt, "srt", {
          maxInputBytes: MAX_SUBTITLE_TEXT_BYTES,
          maxLineCount: MAX_SUBTITLE_LINE_COUNT,
          maxCueCount: 1
        })
      ).toThrow("Subtitle parser cue count exceeds 1.");
    });
  });
});
