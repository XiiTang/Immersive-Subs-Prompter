import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "../common/transcriptionDefaults.js";
import { DEFAULT_YTDLP_ARGS } from "../common/ytdlpDefaults.js";
import { parseYtDlpArgs } from "./ytDlpArgPolicy.js";

const deniedArgLines = [
  ['--exec="sh -c whoami"', "--exec"],
  ['--exec-before-download="sh -c whoami"', "--exec-before-download"],
  ["--config-location=/tmp/yt-dlp.conf", "--config-location"],
  ["--ignore-config", "--ignore-config"],
  ["--output=/tmp/pwned.%(ext)s", "--output"],
  ["-o/tmp/pwned.%(ext)s", "-o"],
  ["-o=/tmp/pwned.%(ext)s", "-o"],
  ["--paths=/tmp/pwned", "--paths"],
  ["-P/tmp/pwned", "-P"],
  ["-P=/tmp/pwned", "-P"],
  ["--external-downloader=curl", "--external-downloader"],
  ["--external-downloader-args=--output /tmp/file", "--external-downloader-args"],
  ["--use-postprocessor=exec", "--use-postprocessor"],
  ["--download-archive=/tmp/archive.txt", "--download-archive"],
  ["--write-info-json", "--write-info-json"],
  ["--write-description", "--write-description"],
  ["--write-thumbnail", "--write-thumbnail"]
] as const;

const allowedArgLines = [
  ["--cookies=/Users/me/cookies.txt", ["--cookies=/Users/me/cookies.txt"]],
  ["--cookies-from-browser=chrome", ["--cookies-from-browser=chrome"]],
  ["--unknown-option=value", ["--unknown-option=value"]],
  ["--extractor-args=youtube:player_client=default", ["--extractor-args=youtube:player_client=default"]],
  ['--postprocessor-args="-ac 1 -ar 16000"', ["--postprocessor-args=-ac 1 -ar 16000"]],
  ["--convert-subs=ass", ["--convert-subs=ass"]]
] as const;

describe("yt-dlp argument policy", () => {
  it("accepts the current subtitle default args", () => {
    expect(parseYtDlpArgs(DEFAULT_YTDLP_ARGS, "subtitle args")).toEqual([
      "--skip-download",
      "--write-subs",
      "--write-auto-subs",
      "--all-subs",
      "--no-playlist"
    ]);
  });

  it("accepts the current transcription default args", () => {
    expect(parseYtDlpArgs(DEFAULT_TRANSCRIPTION_YTDLP_ARGS, "transcription args")).toEqual([
      "--extract-audio",
      "--audio-format=wav",
      "--audio-quality=32K",
      "--postprocessor-args=-ac 1 -ar 16000"
    ]);
  });

  it("accepts cookies and unknown non-denied options", () => {
    for (const [argLine, expected] of allowedArgLines) {
      expect(parseYtDlpArgs(argLine, "yt-dlp args")).toEqual(expected);
    }
  });

  it("rejects denied options", () => {
    for (const [argLine, option] of deniedArgLines) {
      expect(() => parseYtDlpArgs(argLine, "yt-dlp args")).toThrow(
        `yt-dlp args cannot use yt-dlp option ${option}`
      );
    }
  });

  it("rejects raw positional args and separated option values", () => {
    for (const argLine of [
      `${DEFAULT_YTDLP_ARGS} https://attacker.example/watch`,
      "--skip-download https://attacker.example/watch",
      "--sub-lang en.*",
      "--audio-format wav",
      "-",
      "--"
    ]) {
      expect(() => parseYtDlpArgs(argLine, "yt-dlp args")).toThrow(
        "yt-dlp args cannot include positional yt-dlp argument"
      );
    }
  });
});
