import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "../common/transcriptionDefaults.js";
import { DEFAULT_YTDLP_ARGS } from "../common/ytdlpDefaults.js";
import { parseYtDlpArgs, type YtDlpArgPolicy } from "./ytDlpArgPolicy.js";

const deniedArgLines = [
  ['--exec "sh -c whoami"', "--exec"],
  ['--exec-before-download "sh -c whoami"', "--exec-before-download"],
  ["--config-location /tmp/yt-dlp.conf", "--config-location"],
  ["--output /tmp/pwned.%(ext)s", "--output"],
  ["-o /tmp/pwned.%(ext)s", "-o"],
  ["--paths /tmp/pwned", "--paths"],
  ["--external-downloader curl", "--external-downloader"],
  ["--cookies-from-browser chrome", "--cookies-from-browser"],
  ["--unknown-option value", "--unknown-option"]
] as const;

function defaultArgsFor(policy: YtDlpArgPolicy): string {
  return policy === "subtitle" ? DEFAULT_YTDLP_ARGS : DEFAULT_TRANSCRIPTION_YTDLP_ARGS;
}

describe("yt-dlp argument policy", () => {
  it.each<YtDlpArgPolicy>(["subtitle", "transcription"])("accepts the %s default args", (policy) => {
    expect(parseYtDlpArgs(defaultArgsFor(policy), policy, `${policy} args`)).toEqual(
      expect.arrayContaining(policy === "subtitle" ? ["--write-auto-subs"] : ["--extract-audio"])
    );
  });

  it.each<YtDlpArgPolicy>(["subtitle", "transcription"])("rejects positional args for %s settings", (policy) => {
    expect(() =>
      parseYtDlpArgs(`${defaultArgsFor(policy)} https://attacker.example/watch`, policy, `${policy} args`)
    ).toThrow(`${policy} args cannot include positional yt-dlp argument`);
  });

  it.each<YtDlpArgPolicy>(["subtitle", "transcription"])("rejects denied and unknown options for %s settings", (policy) => {
    for (const [argLine, option] of deniedArgLines) {
      expect(() => parseYtDlpArgs(argLine, policy, `${policy} args`)).toThrow(
        option === "--unknown-option"
          ? `${policy} args cannot use unrecognized yt-dlp option ${option}`
          : `${policy} args cannot use yt-dlp option ${option}`
      );
    }
  });

  it("accepts only the product transcription postprocessor args", () => {
    expect(parseYtDlpArgs(DEFAULT_TRANSCRIPTION_YTDLP_ARGS, "transcription", "transcription args")).toContain(
      "-ac 1 -ar 16000"
    );

    expect(() =>
      parseYtDlpArgs('--extract-audio --postprocessor-args "-i /tmp/input"', "transcription", "transcription args")
    ).toThrow("transcription args cannot use custom postprocessor arguments");
  });
});
