# Word Lookup Plugin Design

Date: 2026-05-07

## Scope

Add an official word lookup plugin to Immersive Subs Prompter. The plugin is a personal word-list lookup tool for subtitles, not a general dictionary engine. It supports user-mounted word-list files, modifier-key hover lookup on subtitle text, and a Markdown popup panel for matched entries.

The project has not shipped yet, so this design does not preserve or migrate old word-list data, plugin configuration, or interim code paths. The implementation should target the final shape described here directly.

This document describes only the final product behavior and architecture. It intentionally omits brainstorming history and intermediate alternatives.

Floating window behavior for the lookup panel is defined by `2026-05-07-word-lookup-floating-window-design.md`.

## Goals

- Provide a built-in official plugin named `official.word-lookup`.
- Let users mount a personal word-list file by path.
- Support lookup from any subtitle text, regardless of primary or secondary subtitle role.
- Use modifier-key hover as the only V1 subtitle interaction.
- Render matched entry content as safe Markdown in a floating lookup panel.
- Keep the word-list format small, documented, and independent of MDX, StarDict, or other dictionary formats.

## Non-Goals

- Do not support MDX, StarDict, DSL, SQLite dictionaries, HTML dictionaries, or full dictionary-source management in V1.
- Do not implement complete stemming, lemmatization, Hunspell, or language-specific morphology.
- Do not auto-detect Chinese or Japanese words in unsegmented text.
- Do not support automatic phrase expansion from the hovered token.
- Do not add controls to the main subtitle window for enabling or disabling lookup.
- Do not watch word-list files for live changes in V1.
- Do not allow raw HTML execution from word-list content.

## User Word List JSONL v1

The user-facing word-list format is JSON Lines. Each non-empty line is one JSON object.

Required fields:

- `word`: string. The canonical word or expression.
- `content`: string. Markdown content rendered in the lookup panel.

Optional fields:

- `aliases`: string array. Alternate surface forms that should resolve to the same entry.

Example:

```jsonl
{"word":"run","aliases":["runs","running","ran"],"content":"### Meaning\nMove quickly on foot.\n\n| Form | Example |\n| --- | --- |\n| run | I run daily. |"}
{"word":"look up","aliases":["looks up","looked up"],"content":"### Phrase\nSearch for information."}
```

V1 lookup interaction only extracts the hovered token, so phrase entries are valid in the file format but are not automatically matched by hovering one word inside a phrase. Phrase lookup can be added later with explicit selected-text or longest-match behavior.

## Plugin Configuration

The plugin stores its config under `settings.plugins["official.word-lookup"].config`.

Fields:

- `wordListPath`: string. Absolute or user-entered path to the mounted JSONL file.
- `modifierKey`: `"alt" | "ctrl" | "shift"`. Default is `"alt"` and maps to Alt on Windows/Linux and Option on macOS. `"ctrl"` maps to Ctrl on Windows/Linux and Command on macOS.
- `panelSize`: object with `width` and `height` numbers. The popup remembers size only, not position.

There is no `none` modifier option. Pure mouse hover or pure click lookup is not supported because it conflicts with the existing subtitle click-to-seek workflow.

## Architecture

The feature is implemented as an official bundled plugin with main-process services and renderer contributions.

Main process responsibilities:

- Register the bundled plugin manifest and commands.
- Load and validate the configured word-list file.
- Build an in-memory lookup index.
- Return lookup results through IPC/plugin commands.
- Report load status to the settings UI.

Renderer responsibilities:

- Render the word lookup settings section.
- Capture modifier-key hover over subtitle text.
- Extract a token from the hovered text by whitespace and punctuation boundaries.
- Request lookup results.
- Render the floating Markdown popup.
- Keep or close the floating panel based on pointer movement into and out of the panel.

Existing subtitle components should not learn word-list parsing, indexing, or Markdown rules. They should expose only the minimal event and DOM information needed for renderer-side lookup interaction.

## Main Process Components

`wordLookupTypes.ts`

- Defines plugin config, parsed word entries, indexed entries, load status, lookup request, and lookup result types.

`wordListParser.ts`

- Parses JSONL.
- Ignores empty lines.
- Validates `word`, `content`, and `aliases`.
- Returns structured errors with line number and reason.
- Fails the full load if any line is invalid.

`wordListValidator.ts`

- Validates canonical JSONL word lists without throwing.
- Normalizes JSONL, JSON arrays, single `{ word, content }` objects, and `{ entries: [...] }` objects into canonical JSONL.
- Can skip invalid rows during conversion while reporting skipped row labels and reasons.
- Revalidates generated JSONL before returning it.

`wordListCli.ts`

- Exposes the project script `pnpm word-list:normalize`.
- `pnpm word-list:normalize --check <path>` strictly validates a canonical JSONL file.
- `pnpm word-list:normalize <input> [output]` writes canonical JSONL and skips invalid rows with a warning.

`wordLookupNormalizer.ts`

- Provides token and key normalization.
- Performs Unicode normalization, case folding, leading/trailing punctuation trimming, apostrophe normalization, and punctuation/whitespace folding for lookup keys.
- Does not implement language-specific stemming.

`WordLookupService.ts`

- Owns the current loaded index and status.
- Exposes `load(path)`, `reload()`, `getStatus()`, and `lookup(token)`.
- Reads file metadata including modification time.
- On successful load, replaces the active index atomically.
- On failed reload, preserves the previous successful index if one exists.

`official/wordLookup/manifest.ts`

- Declares plugin id `official.word-lookup`, display name, description, and settings section metadata.

`official/wordLookup/registerMain.ts`

- Registers plugin commands:
  - `getStatus`
  - `refresh`
  - `lookup`

## Renderer Components

`SettingsWordLookup.vue`

- Provides path input and file selection button.
- Provides modifier-key dropdown with Alt/Option, Ctrl/Command, and Shift.
- Provides refresh button.
- Shows status: unconfigured, loading, loaded, failed.
- Shows loaded entry count and file modification time.
- Shows structured load errors.

`wordLookupTokenize.ts`

- Extracts lookup token spans from subtitle line text.
- Uses whitespace and punctuation boundaries for space-delimited text.
- Does not segment CJK text.

`wordLookupMarkdown.ts`

- Renders the supported Markdown subset to safe HTML.
- Escapes raw HTML.
- Keeps only `http` and `https` links clickable.

`SubtitleView.vue`

- Tracks the selected modifier key.
- Handles hover over subtitle text.
- Requests lookup results.
- Requests a floating lookup window when a hovered token has matches.

`WordLookupWindowManager`

- Owns the transient Electron lookup window lifecycle.
- Positions the window in screen coordinates.
- Allows the panel to extend beyond the subtitle window while staying within the display work area.
- Uses lower-right placement by default and lower-left placement when lower-right would overflow horizontally.
- Closes the window according to pointer handoff and panel-leave behavior.
- Remembers size in plugin config.

`WordLookupWindow.vue`

- Renders all matching entries in sorted order.
- Allows content scrolling and text selection.
- Shows a custom auto-hiding scrollbar overlay instead of a visible native scrollbar.
- Provides the lower-right resize handle for resizing the floating lookup window.
- Opens safe external links through IPC.
- Reports pointer enter, pointer leave, and resize events to the main process.
- Does not remember position.

## Subtitle Interaction

The only V1 interaction is modifier-key hover.

- Default modifier: Alt/Option.
- User-configurable modifiers: Alt/Option, Ctrl/Command, Shift.
- The user can hover either primary or secondary subtitle text.
- Lookup does not distinguish subtitle roles.
- Pure hover, pure click, modifier-click, and double-click lookup are not part of V1.
- Existing subtitle click-to-seek behavior remains unchanged.
- The lookup panel is transient. It stays visible while the pointer moves from the trigger word into the panel or remains inside it, and closes when the pointer leaves the panel or does not enter it within the handoff delay.
- Lookup opens immediately while the modifier is held; there is no additional hover delay.

Token extraction:

- Uses whitespace and punctuation as token boundaries.
- Trims leading and trailing punctuation.
- Works best for space-delimited languages such as English.
- Does not segment CJK text.
- Does not expand to phrases.

Misses:

- A miss does not open a panel.
- A miss may show a lightweight visual hint only.
- Misses do not show error banners in the subtitle view.

## Matching And Sorting

The service returns all matching entries. Matches are sorted by quality, then by file order.

Sort order:

1. `word` exactly equals the original token.
2. `word` equals the original token after case folding.
3. `alias` exactly equals the original token.
4. `alias` equals the original token after case folding.
5. `word` matches by normalized key.
6. `alias` matches by normalized key.
7. Entries in the same bucket keep file order.

Duplicate words are valid. Multiple entries with the same word, same normalized key, or overlapping aliases are all displayed. No entry overwrites another entry.

Morphological variants such as `running -> run` should be represented with explicit aliases in the user word list. V1 does not guess them.

## Markdown Rendering

`content` is rendered as Markdown with:

- headings
- paragraphs
- emphasis and strong emphasis
- ordered and unordered lists
- inline code and code blocks
- blockquotes
- links
- tables

Raw HTML is escaped. Scripts are never executed. External resources are not loaded as HTML content.

Links:

- Only `http` and `https` URLs are clickable.
- Clicks open in the system browser through the existing external-link IPC.
- The subtitle window does not navigate to link targets.

If one entry fails to render as Markdown, that entry falls back to escaped plain text. The rest of the popup still renders.

## Loading And Refresh Behavior

The word-list file is referenced by path and is not copied into application data.

The plugin loads the file when:

- the app starts and the plugin is enabled
- the plugin is enabled
- `wordListPath` changes
- the user clicks refresh in settings

The plugin does not watch files for changes. The settings UI exposes manual refresh and shows the file modification time.

Load failure behavior:

- Settings shows the error.
- Subtitle lookup remains silent.
- If a previous successful index exists, it remains active.
- If no previous successful index exists, lookup is unavailable until a successful load.

## Settings UI Status

The settings section should show:

- current word-list path
- selected modifier key
- refresh action
- entry count after successful load
- file modification time after successful load
- current load state
- error summary and first invalid line, when applicable

The settings section should not include theme, font-size, Markdown feature toggles, import workflows, or dictionary format conversion in V1.

## IPC And Plugin System

The existing plugin host supports main-process commands and settings sections. This feature requires a small renderer-side contribution mechanism so enabled plugins can participate in subtitle view interactions.

The new mechanism should be narrow:

- It should allow the word lookup plugin to register hover handling for subtitle text.
- It should not expose arbitrary DOM mutation hooks.
- It should not require subtitle components to import word lookup modules directly.

The preload API should expose only the required commands:

- select a local word-list file
- get word-list status
- reload the word list
- lookup a token

File selection should use the system file picker and return the selected path. Users can also paste or type a path manually.

## Tests

Parser tests:

- valid JSONL
- empty lines
- invalid JSON line
- missing `word`
- missing `content`
- non-string fields
- invalid `aliases`

Normalizer tests:

- case folding
- leading and trailing punctuation
- apostrophe variants
- Unicode normalization
- punctuation and whitespace folded keys

Lookup service tests:

- exact word match
- case-folded word match
- exact alias match
- case-folded alias match
- normalized word match
- normalized alias match
- duplicate entries all returned
- sorting falls back to file order within the same bucket
- failed reload preserves previous successful index

Main/plugin tests:

- plugin catalog includes `official.word-lookup`
- settings contribution appears only when the plugin is enabled
- status and reload commands return structured results
- lookup command returns sorted results

Renderer tests:

- settings page saves path and modifier
- refresh updates status display
- failed load displays structured error
- Markdown popup renders headings, lists, links, code, blockquotes, and tables
- raw HTML is escaped
- external links use system-browser IPC
- popup resize updates saved panel size
- custom scrollbar appears during scroll activity and auto-hides after inactivity
- custom scrollbar thumb drag updates the popup scroll position
- lower-right resize handle updates the floating popup size without closing during drag

Subtitle interaction tests:

- modifier-hover over subtitle text triggers lookup
- hover without modifier does not trigger lookup
- hover works on primary and secondary subtitle lines
- existing subtitle click-to-seek behavior still works
- moving from the trigger token into the floating panel keeps it open
- leaving the floating panel closes it
- leaving the trigger token without entering the panel closes it after the handoff delay
- Escape does not close the panel

## Acceptance Criteria

- A user can enable `official.word-lookup`, set a JSONL word-list path, and see load status.
- A valid word list loads and reports entry count and modification time.
- Invalid word lists show useful settings-page errors and do not spam the subtitle view.
- Holding the configured modifier and hovering a subtitle token opens a Markdown popup when the token matches.
- Duplicate matches are all shown in deterministic sorted order.
- The popup is resizable, scrollable, and remembers size.
- The popup uses a small custom auto-hiding scrollbar rather than a visible native scrollbar.
- The popup can be resized from its lower-right handle.
- The popup can extend outside the subtitle window while staying within the display work area.
- Pointer movement into and out of the panel controls its lifetime.
- Escape does not close the popup.
- Existing subtitle seeking, looping, scrolling, and selection behavior remains intact.
