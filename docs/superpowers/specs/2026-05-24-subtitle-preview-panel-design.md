# Subtitle Preview Panel Design

## Goal

The profile editor includes a fixed-size subtitle preview panel directly below the subtitle style and color settings. The preview updates immediately as the user changes subtitle styling controls, so the final profile appearance can be judged without opening the main subtitle window.

The project is not released. The final implementation does not include compatibility layers, data migrations, legacy setting aliases, or old-code fallback paths.

## Final UI

The Profiles page keeps the existing split layout:

- The left column lists profiles.
- The right column edits the selected profile.

Inside the right editor column, subtitle appearance controls are ordered as:

1. Typography, spacing, scrolling, and metadata controls.
2. Color scheme controls.
3. Subtitle preview panel.
4. URL rules, subtitle priority editors, and yt-dlp arguments.

The preview panel is a fixed `390px x 630px` canvas. This matches the main subtitle window's default opening size. The settings editor already scrolls vertically, so the preview panel can keep the exact canvas size without changing the settings window dimensions.

## Shared Window Size

The main subtitle window default size is `390 x 630`.

The renderer preview and the Electron main window use shared constants for this size:

- `MAIN_WINDOW_DEFAULT_WIDTH = 390`
- `MAIN_WINDOW_DEFAULT_HEIGHT = 630`

The main window reads these constants when creating `BrowserWindow`. The preview panel reads the same constants for its fixed CSS dimensions. This keeps the default app window and the settings preview aligned.

The settings window remains `1000 x 760` and non-resizable. Its `BrowserWindow` options keep `width`, `height`, and `resizable: false`. Redundant `minWidth`, `minHeight`, `maxWidth`, and `maxHeight` constraints are removed because they do not change the final non-resizable behavior.

## Preview Content

The preview uses fixed sample subtitle text from Jane Austen's public-domain novel *Pride and Prejudice*.

The sample data lives in one small preview-only constant so the text can be replaced later without touching rendering logic.

The preview renders three subtitle blocks:

- A normal block before the highlighted sentence.
- A highlighted active block using the famous line: "Till this moment I never knew myself."
- A normal block after the highlighted sentence.

Each block includes primary and secondary subtitle lines. The secondary line is a preview translation string owned by the app, not a runtime translation feature.

## Styled Behavior

The preview panel is read-only. It does not seek, scroll real playback, select words, loop cues, open toolbars, or connect to browser extension state.

The panel reflects every profile setting that affects subtitle panel appearance:

- Primary subtitle font family.
- Primary subtitle font size.
- Secondary subtitle font family.
- Secondary subtitle font size.
- Primary subtitle default color.
- Secondary subtitle default color.
- Active primary subtitle color.
- Active secondary subtitle color.
- Shared line height.
- Primary-to-secondary subtitle gap.
- Subtitle block gap.
- Auto-hide timestamps and action bar.

Normal preview blocks use default primary and secondary colors. The highlighted preview block uses active primary and secondary colors.

When auto-hide timestamps and action bar is enabled, normal block metadata is visually quiet and the highlighted block metadata remains visible. When it is disabled, all preview block metadata remains visible. This mirrors the user-facing effect of the setting without importing real playback interactions.

## Component Boundaries

`SubtitleStylePreview.vue` is a new profile-settings component. It depends on:

- `useDesktopStore()` for `editingProfileSettings`.
- The shared main window size constants.
- Local preview text constants.
- Existing i18n utilities for labels.

It does not depend on `TranscriptSurface`, playback state, cue projection, virtualized layout, or word lookup behavior.

`SettingsProfiles.vue` owns placement only. It renders `SubtitleStylePreview` after `SubtitleStyleFields` and `ColorSchemeGrid`.

Styling lives in the existing renderer stylesheet and uses the current settings UI tokens. The preview canvas itself should read visually like the real dark subtitle panel, not like a form card.

## Validation And Error Handling

The preview trusts the same sanitized profile settings used by the profile editor. It still keeps renderer-side defensive bounds where the existing UI already does so:

- Font sizes render as numeric pixel values.
- Spacing values never render below `0`.
- Line height never renders below `1`.
- Missing font values are normalized by the existing subtitle font helper.

Invalid color input handling stays inside the existing color input and settings sanitization behavior. The preview does not add a separate color validation model.

## Testing Requirements

Main-process tests cover:

- The main window is created at `390 x 630`.
- The settings window remains `1000 x 760` and non-resizable.
- The settings window no longer passes redundant min/max size constraints.

Renderer tests cover:

- The Profiles editor renders the preview after subtitle style and color controls.
- The preview canvas has fixed `390px x 630px` dimensions.
- The preview contains normal and highlighted subtitle blocks.
- Primary typography changes update primary preview line styles.
- Secondary typography changes update secondary preview line styles.
- Default and active color changes update the matching normal or highlighted preview lines.
- Line height, primary-to-secondary gap, and block gap changes update preview layout styles.
- The auto-hide metadata toggle changes metadata visibility state in the preview.

Verification commands:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/window/windowManager.test.ts src/main/window/settingsWindowManager.test.ts
pnpm --filter @immersive-subs/desktop-app test:renderer -- SettingsProfiles SubtitleStylePreview
pnpm --filter @immersive-subs/desktop-app typecheck
```

## Non-Goals

- No compatibility with previous preview behavior.
- No settings data migration.
- No legacy field aliases.
- No reuse of real playback, transcript virtualization, word lookup, looping, or seek behavior.
- No custom preview text editor.
- No automatic translation feature.
- No settings window resizing work.
