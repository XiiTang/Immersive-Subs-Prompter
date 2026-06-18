# yt-dlp Argument Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop app's yt-dlp argument allowlist with a blacklist-only policy that permits cookies arguments while preserving app-owned output and URL boundaries.

**Architecture:** Keep one parser module in `apps/desktop-app/src/main/ytDlpArgPolicy.ts`, but remove subtitle/transcription-specific allowlists and value validators. Callers still reject empty settings, then the policy rejects denied options and raw positional tokens; all other yt-dlp options pass through.

**Tech Stack:** TypeScript, Electron main process, pnpm workspace, Vitest.

---

## File Structure

- Modify: `apps/desktop-app/src/main/ytDlpArgPolicy.ts`
  - Owns shell-like splitting and the single blacklist policy.
- Modify: `apps/desktop-app/src/main/ytDlpArgPolicy.test.ts`
  - Covers accepted cookies args, accepted unknown non-denied args, denied options, and positional rejection.
- Modify: `apps/desktop-app/src/common/transcriptionDefaults.ts`
  - Keeps transcription defaults valid under inline-value policy.
- Modify: `apps/desktop-app/src/common/defaultSettings.ts`
  - Keeps built-in profile presets valid under inline-value policy.
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`
  - Verifies settings persistence accepts cookies and unknown non-denied args, rejects denied args, and accepts all current defaults/presets.
- Modify: `apps/desktop-app/src/main/subtitleService.test.ts`
  - Keeps runtime subtitle tests aligned with inline-value user args and app-owned `-o`.
- Modify: `apps/desktop-app/src/main/transcriptionService.test.ts`
  - Keeps runtime transcription tests aligned with inline-value user args and app-owned `-o`.
- Modify: `apps/desktop-app/src/main/subtitleService.ts`
  - Updates `parseYtDlpArgs()` call signature because the policy no longer takes a subtitle/transcription mode.
- Modify: `apps/desktop-app/src/main/transcriptionService.ts`
  - Updates `parseYtDlpArgs()` call signature because the policy no longer takes a subtitle/transcription mode.
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
  - Updates `validateYtDlpArgLine()` call signature for transcription settings.
- Modify: `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts`
  - Updates `validateYtDlpArgLine()` call signature for subtitle profile settings.

## Task 1: Lock The New Policy With Unit Tests

**Files:**
- Modify: `apps/desktop-app/src/main/ytDlpArgPolicy.test.ts`

- [ ] **Step 1: Replace the current policy tests with blacklist-policy tests**

Replace `apps/desktop-app/src/main/ytDlpArgPolicy.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the policy test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/ytDlpArgPolicy.test.ts --project main
```

Expected: FAIL because `parseYtDlpArgs()` still requires a policy mode, cookies are denied, unknown options are rejected, and defaults still use separated values.

## Task 2: Implement The Blacklist-Only Policy

**Files:**
- Modify: `apps/desktop-app/src/main/ytDlpArgPolicy.ts`
- Modify: `apps/desktop-app/src/main/subtitleService.ts`
- Modify: `apps/desktop-app/src/main/transcriptionService.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Modify: `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts`

- [ ] **Step 1: Replace the policy implementation**

Replace `apps/desktop-app/src/main/ytDlpArgPolicy.ts` with:

```ts
const DENIED_OPTIONS = new Set([
  "-o",
  "-P",
  "--output",
  "--paths",
  "--exec",
  "--exec-before-download",
  "--config-location",
  "--ignore-config",
  "--external-downloader",
  "--external-downloader-args",
  "--use-postprocessor",
  "--download-archive",
  "--write-info-json",
  "--write-description",
  "--write-thumbnail"
]);

const DENIED_SHORT_OPTIONS = ["-o", "-P"] as const;

export function parseYtDlpArgs(input: string, context: string): string[] {
  const args = splitArgs(input);
  validateYtDlpArgs(args, context);
  return args;
}

export function validateYtDlpArgLine(input: string, context: string): void {
  parseYtDlpArgs(input, context);
}

function validateYtDlpArgs(args: string[], context: string): void {
  for (const token of args) {
    if (isPositionalToken(token)) {
      throw new Error(`${context} cannot include positional yt-dlp argument`);
    }

    const deniedOption = getDeniedOption(token);
    if (deniedOption) {
      throw new Error(`${context} cannot use yt-dlp option ${deniedOption}`);
    }
  }
}

function isPositionalToken(token: string): boolean {
  return token === "-" || token === "--" || !token.startsWith("-");
}

function getDeniedOption(token: string): string | null {
  const longOption = parseLongOptionName(token);
  if (longOption !== null) {
    return DENIED_OPTIONS.has(longOption) ? longOption : null;
  }

  for (const shortOption of DENIED_SHORT_OPTIONS) {
    if (token === shortOption || token.startsWith(`${shortOption}=`) || token.startsWith(shortOption)) {
      return shortOption;
    }
  }

  return DENIED_OPTIONS.has(token) ? token : null;
}

function parseLongOptionName(token: string): string | null {
  if (!token.startsWith("--")) {
    return null;
  }
  const separator = token.indexOf("=");
  return separator < 0 ? token : token.slice(0, separator);
}

export function splitArgs(input: string): string[] {
  const result: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && input[i + 1] === quote) {
        current += quote;
        i += 1;
      } else {
        current += char;
      }
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (/\s/.test(char ?? "")) {
      if (current) {
        result.push(current);
        current = "";
      }
    } else if (char === "\\" && input[i + 1]) {
      current += input[i + 1];
      i += 1;
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }
  return result;
}
```

- [ ] **Step 2: Update policy call sites**

In `apps/desktop-app/src/main/subtitleService.ts`, change:

```ts
return parseYtDlpArgs(customLine, "subtitle", "Subtitle yt-dlp args");
```

to:

```ts
return parseYtDlpArgs(customLine, "Subtitle yt-dlp args");
```

In `apps/desktop-app/src/main/transcriptionService.ts`, change:

```ts
return parseYtDlpArgs(customLine, "transcription", "Transcription yt-dlp args");
```

to:

```ts
return parseYtDlpArgs(customLine, "Transcription yt-dlp args");
```

In `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`, change:

```ts
validateYtDlpArgLine(ytDlpArgs, "transcription", `${context}.ytDlpArgs`);
```

to:

```ts
validateYtDlpArgLine(ytDlpArgs, `${context}.ytDlpArgs`);
```

In `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts`, change:

```ts
validateYtDlpArgLine((source.ytDlpArgs as string).trim(), "subtitle", "profile.settings.ytDlpArgs");
```

to:

```ts
validateYtDlpArgLine((source.ytDlpArgs as string).trim(), "profile.settings.ytDlpArgs");
```

- [ ] **Step 3: Run the policy test and verify the remaining failures are defaults**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/ytDlpArgPolicy.test.ts --project main
```

Expected: FAIL only on default argument expectations that still use separated values.

## Task 3: Convert Product Defaults To Inline Values

**Files:**
- Modify: `apps/desktop-app/src/common/transcriptionDefaults.ts`
- Modify: `apps/desktop-app/src/common/defaultSettings.ts`
- Modify: `apps/desktop-app/src/main/ytDlpArgPolicy.test.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`

- [ ] **Step 1: Update transcription defaults**

In `apps/desktop-app/src/common/transcriptionDefaults.ts`, change:

```ts
export const DEFAULT_TRANSCRIPTION_YTDLP_ARGS =
  '--extract-audio --audio-format wav --audio-quality 32K --postprocessor-args "-ac 1 -ar 16000"';
```

to:

```ts
export const DEFAULT_TRANSCRIPTION_YTDLP_ARGS =
  '--extract-audio --audio-format=wav --audio-quality=32K --postprocessor-args="-ac 1 -ar 16000"';
```

- [ ] **Step 2: Confirm subtitle base defaults already match the policy**

Do not edit `apps/desktop-app/src/common/ytdlpDefaults.ts`; it already contains flag-only defaults:

```ts
export const DEFAULT_YTDLP_ARGS =
  "--skip-download --write-subs --write-auto-subs --all-subs --no-playlist";
```

- [ ] **Step 3: Update built-in profile preset args**

In `apps/desktop-app/src/common/defaultSettings.ts`, change the YouTube preset to:

```ts
const YOUTUBE_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_PROFILE_SETTINGS,
  subtitleLineHeight: 1.1,
  subtitleActivePrimaryColor: "#fff8dc",
  subtitleActiveSecondaryColor: "#fff9c4",
  ytDlpArgs:
    "--skip-download --write-subs --write-auto-subs --sub-lang=en.*,zh-Hans.* --sub-format=srt/best",
  subtitleScrollPosition: 33,
  secondarySubtitlePriority: ["zh", "zh-Hans"]
};
```

Change the TikTok preset to:

```ts
const TIKTOK_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_PROFILE_SETTINGS,
  subtitleLineHeight: 1.1,
  subtitleActivePrimaryColor: "#fff8dc",
  subtitleActiveSecondaryColor: "#fff9c4",
  ytDlpArgs:
    "--skip-download --write-subs --write-auto-subs --sub-lang=eng.*,cmn-Hans.* --sub-format=srt/best",
  subtitleScrollPosition: 33,
  primarySubtitlePriority: ["eng", "en", "ai-en"],
  secondarySubtitlePriority: ["cmn-Hans", "zh", "ai-zh", "zh-Hans"]
};
```

Change the Bilibili preset to:

```ts
const BILIBILI_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_PROFILE_SETTINGS,
  ytDlpArgs: "--skip-download --write-subs --write-auto-subs --all-subs --sub-format=srt/best",
  subtitleScrollPosition: 33,
  secondarySubtitlePriority: ["zh", "ai-zh", "zh-Hans"]
};
```

- [ ] **Step 4: Update settings sanitizer tests for blacklist behavior**

In `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`, replace the `deniedArgs` array inside `it("rejects unsafe yt-dlp arguments before settings are persisted", ...)` with:

```ts
      const deniedArgs = [
        ['--exec="sh -c whoami"', "--exec"],
        ['--exec-before-download="sh -c whoami"', "--exec-before-download"],
        ["--config-location=/tmp/yt-dlp.conf", "--config-location"],
        ["--ignore-config", "--ignore-config"],
        ["--output=/tmp/pwned", "--output"],
        ["-o/tmp/pwned", "-o"],
        ["-o=/tmp/pwned", "-o"],
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
```

In the same test, replace both `.toThrow(...)` blocks with:

```ts
        ).toThrow(`profile.settings.ytDlpArgs cannot use yt-dlp option ${option}`);
```

and:

```ts
        ).toThrow(`features.transcription.configs.0.ytDlpArgs cannot use yt-dlp option ${option}`);
```

Then add this test after the unsafe-argument test:

```ts
    it("accepts cookies and unknown non-denied yt-dlp arguments before settings are persisted", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();
      const profile = settings.profiles[0]!;
      const config = settings.features.transcription.configs[0]!;

      for (const argLine of [
        "--cookies=/Users/me/cookies.txt",
        "--cookies-from-browser=chrome",
        "--unknown-option=value",
        "--extractor-args=youtube:player_client=default",
        '--postprocessor-args="-ac 1 -ar 16000"'
      ]) {
        expect(() =>
          validateSettingsForUpdate(
            {
              profiles: settings.profiles.map((item) =>
                item.id === profile.id
                  ? {
                      ...item,
                      settings: {
                        ...item.settings,
                        ytDlpArgs: argLine
                      }
                    }
                  : item
              )
            },
            settings
          )
        ).not.toThrow();

        expect(() =>
          validateSettingsForUpdate(
            {
              features: {
                transcription: {
                  activeConfigId: config.id,
                  configs: [
                    {
                      ...config,
                      ytDlpArgs: argLine
                    }
                  ]
                }
              }
            } as never,
            settings
          )
        ).not.toThrow();
      }
    });
```

Add this test after `it("accepts current yt-dlp defaults before settings are persisted", ...)`:

```ts
    it("accepts built-in profile preset yt-dlp args before settings are persisted", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            profiles: settings.profiles
          },
          settings
        )
      ).not.toThrow();
    });
```

- [ ] **Step 5: Run policy and settings sanitizer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/ytDlpArgPolicy.test.ts src/main/settings/appSettingsSanitizer.test.ts --project main
```

Expected: PASS for both files.

- [ ] **Step 6: Commit policy and defaults**

Run:

```bash
git add apps/desktop-app/src/main/ytDlpArgPolicy.ts \
  apps/desktop-app/src/main/ytDlpArgPolicy.test.ts \
  apps/desktop-app/src/common/transcriptionDefaults.ts \
  apps/desktop-app/src/common/defaultSettings.ts \
  apps/desktop-app/src/main/settings/appSettingsSanitizer.ts \
  apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts \
  apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts \
  apps/desktop-app/src/main/subtitleService.ts \
  apps/desktop-app/src/main/transcriptionService.ts
git commit -m "fix: allow safe yt-dlp custom arguments"
```

## Task 4: Align Runtime Service Tests With Inline Args

**Files:**
- Modify: `apps/desktop-app/src/main/subtitleService.test.ts`
- Modify: `apps/desktop-app/src/main/transcriptionService.test.ts`

- [ ] **Step 1: Update the fake subtitle yt-dlp script to read inline values**

In `apps/desktop-app/src/main/subtitleService.test.ts`, replace the `argValue()` helper inside `createFakeYtDlpScript()` with:

```js
function argValue(name, fallback) {
  const inlinePrefix = name + "=";
  const inline = process.argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) {
    return inline.slice(inlinePrefix.length);
  }
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
```

Keep the `-o` lookup working through the separated form because the app owns `-o <baseOutput>`.

- [ ] **Step 2: Update subtitle service test arg strings**

In `apps/desktop-app/src/main/subtitleService.test.ts`, change:

```ts
    let ytDlpArgs = '--sub-lang "en.*" --sub-format "srt/best"';
```

to:

```ts
    let ytDlpArgs = "--sub-lang=en.* --sub-format=srt/best";
```

Change:

```ts
    ytDlpArgs = "--sub-lang en.* --sub-format srt/best";
```

to:

```ts
    ytDlpArgs = "--sub-lang=en.* --sub-format=srt/best";
```

Change:

```ts
    let ytDlpArgs = "--sub-lang en";
```

to:

```ts
    let ytDlpArgs = "--sub-lang=en";
```

Change:

```ts
    ytDlpArgs = "--sub-lang zh";
```

to:

```ts
    ytDlpArgs = "--sub-lang=zh";
```

Change:

```ts
      () => ({ ytDlpArgs: "--sub-lang en" })
```

to:

```ts
      () => ({ ytDlpArgs: "--sub-lang=en" })
```

- [ ] **Step 3: Update transcription test defaults and expected args**

In `apps/desktop-app/src/main/transcriptionService.test.ts`, change the `createConfig()` default field from:

```ts
    ytDlpArgs: "--extract-audio --audio-format wav",
```

to:

```ts
    ytDlpArgs: "--extract-audio --audio-format=wav",
```

Change the `uses transcription config yt-dlp args when provided` call from:

```ts
      resolveYtDlpArgs({ ytDlpArgs: "--extract-audio --audio-format mp3" }),
```

to:

```ts
      resolveYtDlpArgs({ ytDlpArgs: "--extract-audio --audio-format=mp3" }),
```

Change the expected args from:

```ts
      "--extract-audio",
      "--audio-format",
      "mp3",
      "-o",
      "/tmp/out",
      "https://video.example.test/watch"
```

to:

```ts
      "--extract-audio",
      "--audio-format=mp3",
      "-o",
      "/tmp/out",
      "https://video.example.test/watch"
```

- [ ] **Step 4: Run subtitle and transcription service tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/subtitleService.test.ts src/main/transcriptionService.test.ts --project main
```

Expected: PASS.

- [ ] **Step 5: Commit runtime test alignment**

Run:

```bash
git add apps/desktop-app/src/main/subtitleService.test.ts apps/desktop-app/src/main/transcriptionService.test.ts
git commit -m "test: align yt-dlp service args with blacklist policy"
```

## Task 5: Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Search for removed allowlist concepts**

Run:

```bash
rg -n "SUBTITLE_FLAGS|SUBTITLE_VALUE_OPTIONS|TRANSCRIPTION_FLAGS|TRANSCRIPTION_VALUE_OPTIONS|TRANSCRIPTION_AUDIO_FORMATS|SUBTITLE_CONVERT_FORMATS|PRODUCT_POSTPROCESSOR_ARGS|unrecognized yt-dlp option|cookies-from-browser.*cannot use|--cookies-from-browser chrome" apps/desktop-app/src
```

Expected: no matches.

- [ ] **Step 2: Run focused desktop main tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run \
  src/main/ytDlpArgPolicy.test.ts \
  src/main/settings/appSettingsSanitizer.test.ts \
  src/main/subtitleService.test.ts \
  src/main/transcriptionService.test.ts \
  --project main
```

Expected: PASS.

- [ ] **Step 3: Run desktop app typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck
```

Expected: PASS.

- [ ] **Step 4: Run workspace typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Check whitespace and final diff**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: `git diff --check` prints no output. `git status --short --branch` shows only intended committed changes ahead of `origin/main`.
