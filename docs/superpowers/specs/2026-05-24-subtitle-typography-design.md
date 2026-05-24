# Subtitle Typography Design

## Goal

Subtitle profiles define independent typography for primary and secondary subtitles. Users can choose a curated font and an explicit font size for each subtitle role while keeping shared controls for line height, primary-to-secondary gap, block gap, colors, scroll behavior, and metadata visibility.

The project is not released. There is no compatibility, migration, legacy data handling, fallback path, or transition layer.

## Profile Settings

`ProfileSettings` contains four typography fields:

- `primarySubtitleFontFamily`
- `primarySubtitleFontSize`
- `secondarySubtitleFontFamily`
- `secondarySubtitleFontSize`

The final profile schema does not include a unified subtitle font family or unified subtitle font size.

Font families must come from `SUBTITLE_FONT_OPTIONS`. Invalid or empty font family values resolve to `DEFAULT_SUBTITLE_FONT_FAMILY`.

Font sizes are integer pixel values clamped to `3-96`. Primary and secondary subtitles use the same allowed range.

Default profile typography:

- Primary subtitle font family: `DEFAULT_SUBTITLE_FONT_FAMILY`.
- Secondary subtitle font family: `DEFAULT_SUBTITLE_FONT_FAMILY`.
- `DEFAULT_PROFILE_SETTINGS` primary subtitle font size: `14`.
- `DEFAULT_PROFILE_SETTINGS` secondary subtitle font size: `13`.
- Built-in profile JSON primary subtitle font size: `26`.
- Built-in profile JSON secondary subtitle font size: `25`.

The built-in profile JSON and renderer default profile template use these final fields directly.

## Settings UI

The profile style editor exposes two compact typography rows:

- Primary subtitle font select and primary subtitle font size input.
- Secondary subtitle font select and secondary subtitle font size input.

Both font selects use `SUBTITLE_FONT_OPTIONS`. Both size inputs use `min="3"`, `max="96"`, and `step="1"`.

The rest of the subtitle style controls remain shared:

- Auto-hide timestamps and action bar.
- Auto-scroll restore time.
- Subtitle scroll position.
- Primary-to-secondary subtitle gap.
- Line height.
- Block gap.
- Subtitle colors.

The settings UI includes English and Chinese labels for the four typography controls:

- Primary Subtitle Font / 主字幕字体
- Primary Subtitle Font Size / 主字幕字号
- Secondary Subtitle Font / 副字幕字体
- Secondary Subtitle Font Size / 副字幕字号

## Rendering

The active profile provides separate typography for primary and secondary transcript lines.

`SubtitleView` exposes normalized typography to the transcript surface:

- `primaryFontFamily`
- `primaryFontSize`
- `secondaryFontFamily`
- `secondaryFontSize`

Font family normalization uses the shared curated font helper. Font size normalization clamps values to `3-96`.

`TranscriptSurface` renders each materialized line according to its role:

- Primary lines use primary font family, primary font size, primary text color, and primary active color.
- Secondary lines use secondary font family, secondary font size, secondary text color, and secondary active color.

There is no implicit secondary size offset in rendering. The secondary font size is exactly the configured secondary font size after normalization.

## Pretext Layout Alignment

The transcript layout layer measures text with the same typography that the DOM uses to render it.

Layout input contains:

- Primary font family.
- Primary font size.
- Secondary font family.
- Secondary font size.
- Shared line height.
- Shared primary-to-secondary gap.
- Shared block gap.
- Metadata row height.

Primary text measurement uses:

- Font family: primary font family.
- Font size: primary font size.
- Font weight: primary line weight.
- Line pixel height: `primaryFontSize * lineHeight`.

Secondary text measurement uses:

- Font family: secondary font family.
- Font size: secondary font size.
- Font weight: secondary line weight.
- Line pixel height: `secondaryFontSize * lineHeight * SECONDARY_LINE_HEIGHT_RATIO`.

The pretext `prepareWithSegments(text, font, ...)` call receives a font string built from the same family, size, and weight used by the corresponding rendered line. Prepared text cache keys include the full font string and text, so primary and secondary measurements remain isolated when fonts or sizes differ.

Materialized line styles use the measured line height and role-specific font family and size. This keeps virtualized block heights, line `top` values, DOM `height`, and DOM `line-height` aligned.

## Validation And Error Handling

Profile sanitization enforces the final typography constraints:

- Unsupported primary font family resolves to the default curated font.
- Unsupported secondary font family resolves to the default curated font.
- Non-finite primary font size resolves to the default primary font size.
- Non-finite secondary font size resolves to the default secondary font size.
- Primary and secondary font sizes are rounded and clamped to `3-96`.

Runtime rendering applies the same safe bounds before passing typography into layout and DOM style generation. This prevents malformed in-memory state from breaking transcript measurement.

## Testing Requirements

Main-process settings tests cover:

- Final profile settings include the four primary/secondary typography fields.
- Unsupported primary and secondary font families sanitize to the default curated font.
- Primary and secondary font sizes round and clamp to `3-96`.
- Default profiles use explicit primary and secondary typography.

Renderer settings tests cover:

- The profile editor renders primary and secondary font selects.
- The profile editor renders primary and secondary size inputs with `3-96` bounds.
- Updating each control writes the matching profile setting.
- Unified typography controls are absent.

Subtitle view tests cover:

- Active profile primary typography is passed to `TranscriptSurface`.
- Active profile secondary typography is passed to `TranscriptSurface`.
- Profile typography changes update transcript surface props reactively.

Transcript surface tests cover:

- Primary DOM lines use primary font family and primary font size.
- Secondary DOM lines use secondary font family and secondary font size.
- Updating primary typography changes primary measurement and rendered styles.
- Updating secondary typography changes secondary measurement, rendered styles, and secondary line `top` values.

Pretext layout tests cover:

- Primary and secondary prepared text use distinct font strings when configured differently.
- Primary line height equals `primaryFontSize * lineHeight`.
- Secondary line height equals `secondaryFontSize * lineHeight * SECONDARY_LINE_HEIGHT_RATIO`.
- Materialized line `height`, `lineHeight`, and `top` values match the measured layout blocks.

Verification commands:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- TranscriptSurface SubtitleView SettingsProfiles
pnpm --filter @immersive-subs/desktop-app test:renderer
pnpm --filter @immersive-subs/desktop-app typecheck
```

## Non-Goals

- No compatibility with previous settings data shapes.
- No migration of existing settings.
- No legacy field aliases.
- No custom font input.
- No per-role line height.
- No per-role primary-to-secondary gap.
- No per-role block gap.
- No color model changes.
