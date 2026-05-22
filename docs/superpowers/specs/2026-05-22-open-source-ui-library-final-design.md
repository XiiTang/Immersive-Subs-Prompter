# Open Source UI Library Final Design

Date: 2026-05-22

## Goal

Replace the current ad hoc desktop frontend styling with a polished open-source UI foundation while preserving existing product behavior.

The final UI should look modern, calm, and consistent across desktop settings, official plugin settings, top controls, subtitle-panel controls, playback controls, status surfaces, and word lookup chrome. It should feel like one desktop tool, not separate host, plugin, and feature-specific interfaces.

## Product Constraints

- The project has not launched. No compatibility layer, migration path, legacy style bridge, old data compatibility, or transitional UI state is required.
- This spec describes the target final shape only. It does not describe implementation stages or intermediate states.
- Business logic is out of scope: Pinia state shape, IPC channels, plugin registration, subtitle parsing, media server behavior, transcription behavior, window management, and word lookup data loading remain unchanged unless a UI component contract explicitly requires a display-only event rename.
- Browser extension popup UI is out of scope for this design.
- Subtitle transcript body is out of scope. Do not redesign `TranscriptSurface`, `TranscriptBlock`, transcript layout, projection, virtualization, scrolling, text selection, word token behavior, cue geometry, or loop interaction inside the transcript body.
- Subtitle-panel controls that share the panel with subtitles are in scope: playback actions, track selection, transcription actions, auto-hide actions, status banners, sliders, and icon controls.

## UI Library Direction

Use a local UI primitive layer backed by shadcn-vue style conventions and Reka UI behavior primitives.

shadcn-vue is the visual and structural reference for the local components. It provides a modern, accessible, open-code component model with clean defaults, but its generated component code must be adapted into this project instead of becoming a scattered external API dependency.

Reka UI is the behavior layer for complex interaction primitives such as select, switch, tooltip, popover, dialog, dropdown, tabs, toggle groups, and sliders where it provides better keyboard, focus, and ARIA behavior than hand-rolled controls.

Naive UI and Element Plus are not the target foundation. They provide broad ready-made Vue component sets, but their stronger visual systems and component APIs would create more pressure on the app's custom desktop controls and Electron-specific interaction surfaces.

## Architecture

All business-facing desktop Vue code uses project-owned `Ui*` primitives. Business components do not import `reka-ui` directly and do not depend on shadcn-vue generated APIs.

The local primitive layer is the permanent design-system boundary:

- `components/ui` owns reusable component markup, behavior wrapping, accessibility defaults, sizing, variants, and class contracts.
- `style.css` owns semantic tokens, primitive styling, focus states, surface rules, and cross-surface visual consistency.
- Feature components own layout and product wiring only: settings pages, top panel, plugin settings, subtitle controls, and word lookup chrome pass values/events through existing store/action/IPC flows.
- Complex behavior primitives may wrap Reka UI internally, but the exported project API remains `UiSelect`, `UiSwitch`, `UiTooltip`, `UiPopover`, `UiDialog`, `UiDropdown`, `UiSlider`, and related local components.

Third-party UI details must be contained:

- No feature component imports from `reka-ui`.
- No feature component uses shadcn-vue registry paths directly.
- Tailwind utility classes are not a business styling dependency.
- If shadcn-vue component code is used as a source, its styling is expressed through project classes and semantic CSS tokens.

## Visual Direction

The final desktop UI follows a restrained shadcn-like utility style:

- Solid backgrounds.
- One-pixel borders where separation or affordance is needed.
- Compact control sizing.
- Clear focus rings.
- Small practical radii.
- Consistent icon sizing.
- No decorative visual effects.

Do not use:

- Shadows as a layout or hierarchy system.
- Gradients.
- Glow effects.
- Glass, blur, backdrop filters, or translucent decoration.
- Feature-specific color palettes.
- Plugin-specific visual identities.
- Card stacks as the default page structure.
- Nested cards.
- Marketing-style headings or explanatory blocks.

All visual styling uses the project semantic token system:

- `--ui-bg`
- `--ui-surface`
- `--ui-surface-muted`
- `--ui-text`
- `--ui-text-muted`
- `--ui-border`
- `--ui-accent`
- `--ui-success`
- `--ui-warning`
- `--ui-danger`
- `--ui-info`

Tokens define light and dark themes. Components consume tokens by semantic role, not by hard-coded feature color.

## Component System

The final desktop UI exposes one primitive family:

- `UiButton`: `primary`, `secondary`, `ghost`, and `danger` variants.
- `UiIconButton`: icon-only controls with required accessible labels, active/pressed state, disabled state, and stable square sizing.
- `UiField`: label, value, hint, error, and control slot structure.
- `UiInput`, `UiTextarea`, `UiSelect`, `UiSwitch`, `UiSlider`.
- `UiSegmentedControl`: short mutually exclusive choices such as appearance mode.
- `UiTooltip`, `UiPopover`, `UiDialog`, `UiDropdown`: overlay primitives with managed focus and keyboard behavior.
- `UiListItem`: repeated rows for profiles, plugins, servers, transcription configs, cache entries, and similar records.
- `UiBadge`: compact metadata or status tags.
- `UiStatus`: dot or icon plus text for live state.
- `UiProgress`: determinate and indeterminate progress display.
- `UiEmptyState`: short empty-list message.
- `UiSeparator`: one-pixel section separation where needed.

Rules:

- Same action type uses the same primitive and variant everywhere.
- Same status meaning uses the same tone everywhere.
- Text buttons are used only when the text label is the clearest command representation.
- Icon-only buttons use existing local icon components or a consistent icon library, never emoji.
- Controls must not resize or shift layout when hovered, focused, disabled, active, translated, or populated with realistic content.
- English and Chinese labels must fit without viewport-based font scaling.

## Desktop Settings

The settings window remains a left navigation plus one active content section.

Final shape:

- Header is plain and functional.
- Navigation uses one selected state, one hover state, and one disabled state.
- Each section renders through shared primitives.
- Host settings and official plugin settings share the same navigation and content model.
- Appearance remains a first-class section.
- General, Profiles, Cache, Plugins, Transcription, Word Lookup, and Jellyfin / Emby use the same field, list, badge, button, switch, progress, and status semantics.

Settings pages must not define their own button systems, card systems, badge systems, status palettes, field layouts, or local surface language.

## Official Plugin Settings

Official plugin settings must look native to the host app.

Transcription:

- Config lists use `UiListItem`.
- Provider, API URL, model, language, prompt, yt-dlp args, and extra JSON use shared field primitives.
- Faster-Whisper runtime, binaries, models, download progress, and errors use shared sections, fields, badges, progress, and status primitives.
- No Faster-Whisper-specific visual language remains.

Word Lookup:

- Word list path, trigger key, refresh action, status stats, and errors use shared primitives.
- Status presentation uses compact shared status and badge components.
- Word lookup chrome uses shared surface, border, scrollbar, link, code, quote, and table tokens.

Jellyfin / Emby:

- Server lists use `UiListItem`.
- Server name, URL, API key, WebSocket path, and enabled state use shared field and switch primitives.
- Connection status and validation errors use shared status/error components.
- No media-server-specific panel styling remains.

Plugins:

- Plugin catalog entries use the same repeated-row style as other configuration records.
- Enable/disable actions use shared buttons.
- Version, enabled state, errors, and metadata use shared badges and status primitives.

## Top Control Panel

The top control panel uses the same primitive language as settings while preserving existing Electron behavior.

Final shape:

- A compact solid surface.
- Drag regions continue to work.
- Pin, fullscreen, settings, opacity, auto-hide, and related actions use `UiIconButton`, `UiSlider`, and shared status primitives.
- Media title, profile, URL, connection state, and active video controls keep the existing information hierarchy.
- Track selectors use `UiSelect`.
- Transcription actions use shared button and status primitives.
- Playback controls use stable icon button sizing and shared slider styling.
- Status banners use shared status surfaces with text; color is never the only signal.

The panel must not introduce decorative backgrounds, custom feature palettes, layout shadows, or control-specific one-off styles.

## Subtitle-Panel Controls

Controls shown with the subtitle panel are in scope; subtitle text rendering is not.

In-scope controls:

- Play and pause.
- Scrubbing slider and progress display.
- Auto-hide toggle.
- Track selectors.
- Transcription selection and start action.
- Status banners and inline status messages.
- Pin, fullscreen, settings, opacity, and related panel actions when shown in the same control surface.

These controls use local UI primitives or exact primitive-compatible styling. They must preserve existing events, timing behavior, and state wiring.

Out-of-scope transcript body behavior remains untouched:

- Cue projection.
- Transcript geometry.
- Virtualized scrolling.
- Word selection and lookup trigger behavior.
- Loop selection and cue timing.
- Screenshot-sensitive transcript layout.

## Word Lookup Chrome

Word lookup floating UI adopts shared theme tokens and primitives for chrome and controls.

Final shape:

- Window surface, border, title/chrome actions, resize handles, close/pin/refresh controls, and scrollbars use shared tokens.
- Links, inline code, blocks, quotes, and tables use shared readable content tokens.
- User-select behavior remains appropriate for dictionary content.
- Entry content stays compact and text-first; it does not become a nested component showcase.

## Data Flow

UI primitives are presentational and interaction components. They emit values and events through stable local component contracts.

Feature components continue to own:

- Store reads and writes.
- IPC calls.
- Plugin setting registration.
- Media server actions.
- Transcription actions.
- Window actions.
- Word lookup refresh and status handling.
- Subtitle control events.

The final UI foundation does not change persistence formats, IPC payload formats, plugin manifest formats, or subtitle data contracts.

## Error And Status Handling

Errors and statuses use shared presentation rules:

- Field validation errors render through `UiField` error slots.
- Connection, transcription, download, cache, plugin, and media server states render through `UiStatus` or `UiBadge`.
- Progress renders through `UiProgress`.
- Empty lists render through `UiEmptyState`.
- Dangerous or destructive actions use the `danger` button variant and explicit text.
- Disabled controls expose disabled state visually and semantically.
- Color is not the only signal for important state.

## Accessibility

- Every icon-only control has an accessible label.
- Toggle and pressed states are exposed semantically where applicable.
- Reka-backed overlays and composite controls preserve keyboard navigation, focus trapping, focus return, and ARIA roles.
- Focus states are visible in light and dark themes.
- Form labels are explicit.
- Text remains readable in English and Chinese.
- Interactive targets remain practical for a desktop utility.

## Testing And Verification

Required verification:

- Desktop renderer tests pass.
- Desktop renderer typecheck passes.
- Existing settings, plugin settings, top panel, subtitle control, and word lookup tests remain behaviorally valid.
- Transcript geometry, projection, scrolling, selection, and screenshot-sensitive tests do not change because transcript body behavior is out of scope.
- UI primitive tests cover variants, disabled state, accessibility labels, keyboard interaction where applicable, model binding, and event passthrough.
- Guardrail tests enforce that feature components do not import `reka-ui` directly.
- Guardrail tests enforce that non-transcript UI does not reintroduce feature-specific visual systems, shadows, gradients, glass effects, or plugin-only palettes.

## Local Reference Projects

Implementation planning and component design should explicitly inspect these local reference projects:

- shadcn-vue: `/Users/cq-laptop/Projects/referrence projects/shadcn-vue`
- Reka UI: `/Users/cq-laptop/Projects/referrence projects/reka-ui`
- Lucide icons: `/Users/cq-laptop/Projects/referrence projects/lucide`
- UI reference project: `/Users/cq-laptop/Projects/referrence projects/ui`

## References

- shadcn-vue introduction: https://www.shadcn-vue.com/docs/introduction
- shadcn-vue components: https://www.shadcn-vue.com/docs/components
- Reka UI introduction: https://reka-ui.com/docs/overview/introduction
- Reka UI installation: https://reka-ui.com/docs/overview/installation
- Naive UI repository: https://github.com/tusen-ai/naive-ui
- Element Plus component overview: https://element-plus.org/en-US/component/overview.html
