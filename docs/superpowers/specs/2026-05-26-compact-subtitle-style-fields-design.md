# Compact Subtitle Style Fields Design

## Goal

The profile editor presents subtitle style controls in a compact property-panel layout so users can adjust subtitle appearance with much less scrolling before reaching the fixed subtitle preview.

The subtitle preview remains a true `390px x 630px` canvas. The settings window size remains unchanged. The project has not shipped, so the final implementation does not include compatibility layers, data migrations, legacy setting aliases, fallback layouts, or old-code preservation.

## Final UI

The Profiles page keeps the existing split layout:

- The left column lists profiles.
- The right column edits the selected profile.

Inside the right editor column, subtitle-related content is ordered as:

1. Compact subtitle style property panel.
2. Fixed subtitle preview canvas.
3. URL rules, subtitle priority editors, and yt-dlp arguments.

The compact subtitle style property panel replaces the current vertically stacked Typography, Layout, and Behavior groups. It shows all existing subtitle style controls without hiding them behind disclosure panels.

The panel uses dense rows with short labels, controls, and current values. Labels must truncate cleanly when needed, and controls must not overflow the editor column in English or Chinese.

## Compact Control Layout

Primary subtitle typography appears as one compact row group containing:

- Primary subtitle font select.
- Primary subtitle font size slider.
- Current primary font size value.

Secondary subtitle typography appears as one compact row group containing:

- Secondary subtitle font select.
- Secondary subtitle font size slider.
- Current secondary font size value.

Subtitle colors remain directly visible in the style panel:

- Primary subtitle color.
- Secondary subtitle color.
- Active primary subtitle color.
- Active secondary subtitle color.

The four color controls render as compact swatches in one row when space allows, or a controlled two-by-two grid when necessary. They remain editable through the existing color interaction model.

Subtitle layout controls render as compact slider rows:

- Subtitle scroll position.
- Primary-to-secondary subtitle gap.
- Line height.
- Block gap.

Behavior controls render in one compact row:

- Auto-hide timestamps and action bar.
- Auto-scroll restore time in seconds.

The final layout must keep all these controls visible in the style panel. It must not introduce collapsed sections, tabs, popovers for ordinary controls, or a separate style-editing mode.

## Preview

`SubtitleStylePreview` remains directly below the compact style panel.

The preview canvas remains fixed at:

- Width: `390px`.
- Height: `630px`.

The preview continues to reflect all subtitle style settings immediately:

- Primary and secondary font family.
- Primary and secondary font size.
- Default and active subtitle colors.
- Line height.
- Primary-to-secondary gap.
- Block gap.
- Subtitle scroll position.
- Metadata auto-hide behavior.

No preview behavior changes are part of this design. The preview remains read-only and does not add seeking, real playback, custom preview text editing, or resizing.

## Component Boundaries

`SettingsProfiles.vue` owns placement only. It renders the compact style panel before `SubtitleStylePreview`, then renders the remaining profile sections.

`SubtitleStyleFields.vue` owns the compact style control layout. It continues to bind to `store.editingProfileSettings` and the existing profile-setting update APIs.

`ColorSchemeGrid.vue` may remain as the color-control component, but its rendered layout must fit inside the compact style panel.

`SubtitleStylePreview.vue` keeps its current role and size contract. It does not gain layout responsibility for the settings controls.

Styling lives in the existing renderer stylesheet and uses current settings UI tokens. New CSS must define stable row heights, grid tracks, label truncation, slider/value alignment, and responsive wrapping for the compact color controls.

## Data Flow

The profile settings data model does not change.

All existing fields remain final fields:

- `primarySubtitleFontFamily`
- `primarySubtitleFontSize`
- `secondarySubtitleFontFamily`
- `secondarySubtitleFontSize`
- `subtitleAutoHideMetaRow`
- `subtitleAutoScrollTimeout`
- `subtitlePrimarySecondaryGap`
- `subtitleLineHeight`
- `subtitlePrimaryColor`
- `subtitleSecondaryColor`
- `subtitleActivePrimaryColor`
- `subtitleActiveSecondaryColor`
- `subtitleScrollPosition`
- `subtitleBlockGap`

Font selects continue to persist through `store.updateProfileSetting`.

Font-size, spacing, line-height, block-gap, and scroll-position sliders continue to update local profile state immediately while deferring persistence until debounce or commit.

Color interactions continue to update local profile color state immediately while deferring persistence until debounce or commit.

The preview continues to read the edited profile settings and update in real time.

## Validation And Error Handling

The compact layout trusts the same sanitized profile settings used by the current profile editor. It does not add a separate validation model.

Renderer-side defensive display behavior remains:

- Font sizes render as numeric pixel values within the existing bounds.
- Spacing values render as non-negative pixel values.
- Line height renders with the existing minimum.
- Font family values resolve through the existing curated font helper.
- Invalid colors continue to be handled by the existing color input and settings sanitization behavior.

## Testing Requirements

Renderer tests cover:

- The profile editor renders a compact subtitle style panel before the subtitle preview.
- Typography, Layout, and Behavior group headings are not rendered as separate stacked sections.
- Primary font family, primary font size, and primary size value appear in the primary typography row group.
- Secondary font family, secondary font size, and secondary size value appear in the secondary typography row group.
- The four color controls remain visible inside the compact style panel.
- The four layout sliders remain visible inside the compact style panel.
- Auto-hide metadata and auto-scroll restore time controls remain visible inside the compact style panel.
- The compact style panel is shorter than the previous grouped layout target height used by the test fixture.
- Key compact rows do not overflow the editor column.
- The subtitle preview still renders after the compact style panel.
- The subtitle preview canvas still computes to `390px x 630px`.
- Slider input still updates local profile settings without immediately calling the main-process settings writer.
- Slider commit still flushes the pending settings payload.
- Color palette drag still updates local profile settings without immediately calling the main-process settings writer.
- Color palette commit still flushes the pending settings payload.
- Preview styles still update from edited profile settings.

Verification commands:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- SettingsProfiles
pnpm --filter @immersive-subs/desktop-app typecheck
```

## Non-Goals

- No subtitle preview resizing.
- No settings window resizing.
- No collapsed style sections.
- No hidden subtitle style controls.
- No separate style-editing mode.
- No profile schema changes.
- No default setting changes.
- No compatibility with previous layouts, previous data shapes, or legacy code paths.
- No settings migration.
