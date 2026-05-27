# Timestamp Font Size Design

## Goal

The profile editor adds an independent control for subtitle timestamp font size. The setting affects the real subtitle transcript and the settings preview immediately, including the timestamp text and the adjacent play, A-B, and loop controls.

## Current Context

Profile typography settings currently include primary and secondary subtitle font family and font size. The transcript metadata row is fixed at 18px high, with timestamp text at 11px and action controls at 12px in CSS. Layout measurement also receives a fixed metadata row height, so changing only CSS would risk clipped or overlapping controls.

The preview already renders the same `TranscriptSurface` component as the real subtitle panel, so a profile setting passed through that component can update both surfaces with the same behavior.

## Settings Model

Add `subtitleTimestampFontSize` to `ProfileSettings`.

The value is a number in pixels:

- Minimum: 6
- Maximum: 24
- Default: 11

The main-process profile sanitizer clamps and rounds the value with the same pattern used by subtitle font sizes. Missing or invalid values fall back to the default, preserving existing profiles.

Renderer defaults mirror the main-process default so tests and preview fallback state stay consistent.

## Settings UI

`SubtitleStyleFields.vue` adds a compact slider labeled `Timestamp Size` in the existing subtitle style panel. It uses deferred persistence like the other slider-based profile style settings, so dragging updates local state and the preview immediately while writes are debounced and flushed on commit.

The control belongs with the existing layout and typography controls. It should not add explanatory helper text because the preview shows the effect directly.

## Transcript Rendering

`SubtitleView.vue` reads `subtitleTimestampFontSize` from the active profile, normalizes it to 6-24px, and passes it into `TranscriptSurface`.

`SubtitleStylePreview.vue` reads the same setting from `editingProfileSettings`, normalizes it with the default fallback, and passes it into `TranscriptSurface`.

`TranscriptSurface.vue` accepts a `timestampFontSize` prop. It derives metadata row height from that value instead of using the current fixed 18px constant. A small padding buffer keeps icon hover scaling from clipping:

- Metadata row height: `max(18, timestampFontSize + 7)`
- Action icon size: `max(12, round(timestampFontSize * 1.1))`

The derived values are included in block layout measurement and passed to each rendered `TranscriptBlock`.

`TranscriptBlock.vue` passes metadata sizing down to `CueAnchorRail` through inline CSS custom properties. CSS keeps the existing visual states and hover transitions, but timestamp text and action controls now use the provided variables instead of fixed font sizes.

## Data Flow

```text
ProfileSettings.subtitleTimestampFontSize
  -> Settings slider / editingProfileSettings
  -> SubtitleStylePreview
  -> TranscriptSurface
  -> layout measurement + TranscriptBlock
  -> CueAnchorRail timestamp and controls

ProfileSettings.subtitleTimestampFontSize
  -> active profile in SubtitleView
  -> TranscriptSurface
  -> layout measurement + TranscriptBlock
  -> CueAnchorRail timestamp and controls
```

## Testing

Focused tests should cover:

- Sanitizer clamps `subtitleTimestampFontSize` to 6-24px and preserves the default for missing values.
- Settings profile slider updates `editingProfileSettings.subtitleTimestampFontSize` and flushes deferred persistence on commit.
- Subtitle view or transcript surface applies the timestamp font-size CSS variable and increases metadata row layout height for larger values.
- Existing profile settings tests are updated for the new required field.

Suggested verification:

```bash
pnpm --filter @immersive-subs/desktop-app test:main -- appSettingsSanitizer
pnpm --filter @immersive-subs/desktop-app test:renderer -- SettingsProfiles SubtitleView
```
