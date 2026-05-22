# Frontend UI Refactor Design

Date: 2026-05-22

## Goal

Refactor all frontend UI into a clean, modern, consistent interface across the desktop client, official plugin settings, desktop control surfaces, and browser extension popup.

The final product should feel like one application rather than separate host, plugin, and extension interfaces. Remove unnecessary visual decoration and repeated explanatory text. Keep only information that helps users make correct configuration decisions.

## Product Constraints

- The project has not launched. No compatibility layer or migration path is required for old UI structure, style names, or settings shape.
- The design spec describes the target final shape only. Implementation notes should avoid step-by-step migration narration.
- Do not redesign the subtitle text panel itself. `TranscriptSurface`, `TranscriptBlock`, subtitle text layout, subtitle scrolling behavior, text selection, word lookup token behavior, and loop interaction inside the subtitle body are out of scope.
- Subtitle controls may be redesigned, including top controls, playback controls, track selection, transcription controls, and related status messages.

## Scope

Included:

- Desktop settings window.
- Host settings sections.
- Official plugin settings sections.
- Plugin management UI.
- Top control panel and subtitle control widgets.
- Word lookup popover/window chrome where it is not part of subtitle body text layout.
- Browser extension popup, including media status, connections, blacklist, and appearance controls.
- Shared color, spacing, typography, button, form, list, badge, status, and empty-state language.

Excluded:

- Subtitle transcript body visual layout.
- Core subtitle projection, virtualization, scrolling, selection, cue timing, and loop behavior.
- Backend behavior unrelated to storing theme preferences.

## Theme Model

All frontend surfaces support three appearance modes:

- `system`: follow OS/browser color scheme.
- `light`: force light mode.
- `dark`: force dark mode.

Desktop and extension preferences are independent.

Desktop:

- Add an appearance setting under global settings.
- Apply theme to the renderer root through a document-level attribute such as `data-theme`.
- In `system` mode, respond to `prefers-color-scheme` changes.
- Use the same theme tokens in settings, plugin settings, top controls, and non-transcript floating UI.
- Subtitle text colors continue to come from subtitle/profile settings where applicable.

Extension:

- Store appearance preference in extension local storage.
- Apply the resolved theme at popup startup.
- Expose the same three options inside the popup.
- Match desktop visual tokens and component semantics, while keeping extension storage independent from desktop connection state.

## Visual Direction

Use a quiet, utility-focused style:

- Neutral gray foundation in both light and dark modes.
- One restrained accent color for selected state and primary actions.
- Status colors only where they carry meaning: success, warning, danger, info.
- No decorative gradients, heavy shadows, nested cards, oversized headings, or ornamental borders.
- Cards are used only for repeated items or genuinely grouped records.
- Settings sections are layouts, not card stacks.
- Borders are reduced to controls, selected list items, critical states, and places where separation is necessary for scanning.
- Spacing and type should make dense configuration readable without feeling cramped.

## Information Density

Use medium simplification:

- Remove generic introductions, repeated section descriptions, and obvious helper text.
- Keep hints for fields where users can easily misconfigure the app: network addresses, auth tokens, file paths, regex, API keys, model/runtime paths, cache retention, and destructive actions.
- Preserve concrete status and error text.
- Prefer compact status badges and inline field hints over large explanatory blocks.

## Desktop Settings Layout

The settings window uses a left navigation and a single active section.

Target layout:

```text
+------------------------------------------------+
| Settings                         Appearance    |
+--------------+---------------------------------+
| General      | Current section title           |
| Appearance   | Fields, lists, and actions       |
| Profiles     |                                 |
| Cache        |                                 |
| Plugins      |                                 |
| Transcription|                                 |
| Word Lookup  |                                 |
| Jellyfin     |                                 |
+--------------+---------------------------------+
```

Requirements:

- Render only the active section content.
- Host and enabled plugin sections appear in the same navigation model.
- The Appearance section is first-class, not hidden inside General.
- Navigation items use one consistent selected, hover, and disabled style.
- Section headers are short. They should not include marketing-style descriptions.
- Large scrollable documents are removed from settings.

## Shared UI Components

Introduce desktop Vue UI primitives and use equivalent CSS semantics in the extension popup.

Desktop components:

- `UiButton`: `primary`, `secondary`, `ghost`, `danger`.
- `UiIconButton`: icon-only actions such as add, delete, refresh, open folder, back, settings.
- `UiField`: label, hint, error, and control layout.
- `UiInput`, `UiTextarea`, `UiSelect`, `UiSwitch`.
- `UiSection`: active settings section shell.
- `UiListItem`: selectable and repeated rows.
- `UiBadge` and `UiStatus`: enabled, disabled, error, connected, connecting, playing, paused.
- `UiEmptyState`: compact empty messages.

Component rules:

- Same action type gets the same style everywhere.
- Same status meaning gets the same color everywhere.
- Icon-only actions use icons and accessible labels.
- Text buttons are only used for clear textual commands that are not better represented by an icon.
- Inputs, selects, textareas, switches, sliders, and buttons share sizing, radius, focus, disabled, and error behavior.
- No card inside card patterns.

## Host Settings

General:

- Keep language, startup, network, shortcut, and process blacklist controls.
- Move appearance out into its own section.
- Keep network endpoint and binding hints because mistakes block connection setup.
- Use compact list-item chips for process blacklist values.

Appearance:

- Provide a three-option segmented control: system, light, dark.
- The control affects desktop renderer surfaces immediately.

Profiles:

- Keep list + editor layout, but use shared list items and shared fields.
- Profile URL rules remain inside profile editing.
- Color controls use compact swatches with unified fields.
- Subtitle priority editors use shared list/chip styles.
- Preserve regex help because it affects correctness.

Cache:

- Keep enable switch, cache path, retention, open folder, refresh stats, and compact stats.
- Avoid large status cards; use concise stat rows or badges.

Plugins:

- Plugin entries use the same repeated item style as other lists.
- Enable, disable, version, status, description, and error remain.
- Plugin cards do not use unique plugin-only button or badge styles.

## Official Plugin Settings

All plugin settings use the same visual language as host settings.

Transcription:

- Config list uses shared list items.
- Provider, API, model, language, prompt, yt-dlp args, and extra JSON use shared fields.
- Faster-Whisper runtime, binaries, and models use grouped layouts without nested card styling.
- Download progress and errors use shared status/progress styles.

Word Lookup:

- Word list path, trigger key, refresh action, and status stats remain.
- Status presentation uses compact shared stats.
- Errors use shared danger status.

Jellyfin / Emby:

- Server list uses shared list items.
- Server name, URL, API key, WebSocket path, and enabled switch use shared fields.
- No unique media-server-only panel styling.

## Top Controls And Subtitle Controls

Allowed changes:

- Simplify `TopControlPanel` chrome.
- Unify icon buttons, select controls, playback button, progress slider, track selectors, transcription controls, and status banners.
- Reduce borders and decorative color use.
- Keep controls readable at small window sizes.
- Preserve drag regions and window interaction behavior.

Not allowed:

- Redesign transcript body appearance.
- Change subtitle text layout or subtitle block geometry.
- Change transcript virtualization behavior.

## Word Lookup Floating UI

Word lookup popup/window may adopt shared theme tokens for chrome, border, resize handle, scrollbar, and status.

The entry content itself remains readable and neutral:

- Preserve user-select behavior.
- Keep Markdown-like content styles compact.
- Use theme tokens for text, link, code, quote, and table colors.

## Browser Extension Popup

The extension popup is redesigned to match the desktop style while remaining native DOM.

Requirements:

- Add independent appearance selection: system, light, dark.
- Header uses compact status plus icon actions.
- Connections, blacklist, and appearance are presented as focused panels or drawers with the same button, field, list, badge, and empty-state semantics.
- Media items use the same repeated-item style as plugin/server/config rows.
- Remove decorative card shadows and heavy borders.
- Keep useful media details: title, play state, site/host, progress, time, speed, volume, resolution, PiP, errors, and open tab action.
- Keep connection details and validation errors.
- Keep blacklist match mode, pattern input, regex validation, add, and remove.

## Accessibility

- All icon-only buttons have accessible names.
- Focus states are visible in both light and dark modes.
- Color is not the only signal for important status where text is available.
- Form labels are explicit.
- Popup drawers or panels maintain sensible focus return behavior.
- Text must fit inside controls in Chinese and English.

## Testing And Verification

Required verification:

- Desktop renderer tests pass.
- Desktop renderer typecheck passes.
- Extension tests pass.
- Extension build passes.
- Light, dark, and system modes are manually checked on desktop settings, plugin settings, top controls, word lookup chrome, and extension popup.
- Existing subtitle transcript screenshot/geometry-sensitive tests should remain focused on unchanged transcript behavior.

Screenshot baselines may be updated for settings and extension UI because the final UI is intentionally different.
