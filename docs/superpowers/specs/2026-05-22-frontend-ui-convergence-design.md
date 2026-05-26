# Frontend UI Convergence Design

Date: 2026-05-22

## Goal

Converge every frontend surface into one modern, minimal, solid-color, line-based product UI.

The final interface should feel like a quiet desktop utility: dense enough for repeated configuration work, visually calm, and consistent across the desktop client, settings, official plugin settings, subtitle controls, word lookup chrome, and browser extension popup.

## Product Constraints

- The project has not launched. No compatibility layer, migration path, legacy style bridge, old class compatibility, old data compatibility, or transitional UI state is required.
- The design spec describes the target final shape only. It must not preserve old UI concepts for migration reasons.
- The user only cares about the final UI state. Implementation documents should avoid explaining intermediate modification steps.
- Do not redesign the subtitle transcript body itself unless a later request explicitly changes this boundary. Transcript text layout, transcript block geometry, virtualization, scrolling, selection, word token behavior, and loop interaction remain out of scope.
- Subtitle controls, top controls, status banners, track selectors, transcription controls, and word lookup window chrome are in scope.

## Visual Direction

The target visual style is a pure tool UI:

- Solid backgrounds only.
- One-pixel lines for separation.
- No shadows.
- No gradients.
- No glow effects.
- No glass, blur, translucent decoration, or layered card effects.
- No decorative color washes.
- No emoji as interface icons.
- No component-specific accent palettes.
- No plugin-specific visual personality.

The UI should read closer to Linear, VS Code settings, or a modern system preferences panel than to a marketing dashboard.

## Color System

All frontend surfaces use one semantic token set:

- `bg`: app background.
- `surface`: primary content surface.
- `surface-muted`: secondary fill.
- `text`: primary text.
- `text-muted`: secondary text.
- `border`: default one-pixel line.
- `accent`: selected state and primary action.
- `success`: successful/connected/enabled status.
- `warning`: warning/intermediate status.
- `danger`: destructive/error status.
- `info`: neutral activity/progress status.

Rules:

- Components do not define their own colors.
- Feature areas do not define their own palettes.
- Dark and light modes use the same semantic roles.
- Status colors appear only when the status meaning is real.
- Accent color appears only for selected navigation, primary action, active focus, and important active state.
- Plain text and borders carry most hierarchy.

## Shape And Surface Rules

The design uses line and spacing, not decorative containers.

- Radius is consistent, small, and practical: 6px for controls, 8px for grouped surfaces.
- Borders are `1px` and use the shared `border` token.
- Cards are not a default layout primitive.
- Repeated records use list rows, not floating cards.
- Page sections are not styled as cards.
- No card inside card.
- No heavy panel backgrounds.
- No local box shadows.
- Focus rings are the only allowed outline-like visual emphasis beyond borders.

Allowed surfaces:

- Main app background.
- Settings/content surface.
- Muted sidebar or row background.
- Modal/drawer/popup surface.
- List row surface.

Disallowed surfaces:

- Decorative glass panels.
- Plugin-only cards.
- Floating card stacks for settings.
- Shadow-separated groups.
- Gradient-filled panels.

## Typography

Typography is restrained and utility-focused.

- One sans-serif stack across desktop and extension.
- No oversized section headlines.
- Section titles are short and functional.
- Field labels are compact and consistent.
- Helper text is smaller and muted.
- Monospace is used only for paths, tokens, URLs, regex examples, or code-like values.
- Letter spacing is zero except where native small uppercase status labels already require legibility, and those should be rare.

## Spacing And Density

Use a single spacing scale:

- 4px for tiny gaps.
- 8px for control internals and compact row gaps.
- 12px for field and row spacing.
- 16px for section body spacing.
- 24px for major layout separation.

The product should keep medium density:

- Configuration pages should be scannable without feeling sparse.
- Repeated hints and obvious descriptions are removed.
- Hints stay only where mistakes break correctness: network addresses, auth tokens, paths, regex, API keys, model/runtime paths, cache retention, destructive actions, and validation constraints.

## Component System

All desktop Vue UI uses one shared primitive family. The extension popup uses equivalent native DOM classes and tokens.

Required primitives and meanings:

- `Button`: primary, secondary, ghost, danger.
- `IconButton`: icon-only action with accessible label.
- `Field`: label, hint, error, value, and control layout.
- `Input`, `Textarea`, `Select`, `Switch`.
- `Section`: active page or major settings section.
- `ListItem`: selectable or repeated row.
- `Badge`: compact state or metadata.
- `Status`: dot + text state when a live state is needed.
- `EmptyState`: one short empty message.
- `SegmentedControl`: mutually exclusive short option set such as appearance.

Rules:

- Same function means same primitive and same visual style everywhere.
- Same status meaning means same badge/status tone everywhere.
- Text buttons are used only where text is clearer than an icon.
- Icon buttons use real icon components or consistent symbol assets, not emoji.
- Raw feature classes can exist for layout hooks, but visual styling must come from shared primitives or shared tokens.

## Desktop Settings

The settings window remains a left-nav, single-active-section interface.

Final shape:

- Header: plain title, solid surface, no border unless needed for separation.
- Left nav: muted surface, one selected style, one hover style.
- Content: one active section at a time.
- Host and plugin settings appear in the same nav model.
- Desktop theme is a compact General setting, not a standalone Appearance section.
- General, Profiles, Cache, Plugins, Transcription, Word Lookup, and Jellyfin / Emby use the same field, row, badge, and button styles.

No settings page may introduce:

- Its own card design.
- Its own button design.
- Its own badge design.
- Its own status colors.
- Decorative grouping panels.

## Official Plugin Settings

Official plugin settings must look native to the host app.

Transcription:

- Configs use shared list rows.
- Whisper API and Faster-Whisper fields use shared field primitives.
- Runtime, binary, model, download, and progress states use shared groups, badges, buttons, and progress styling.
- No `fw-*` visual identity remains.

Word Lookup:

- Path, trigger key, refresh action, status stats, and errors use shared primitives.
- Word lookup chrome uses shared surface, border, scrollbar, text, link, code, quote, and table tokens.

Jellyfin / Emby:

- Server list uses shared list rows.
- Form uses shared fields.
- Enable state uses shared switch and badge semantics.
- No media-server-specific panel styling remains.

Plugins:

- Plugin catalog entries use the same list row style as profiles, configs, and servers.
- Enable/disable actions use shared buttons.
- Version and status use shared metadata/badges.

## Desktop Controls

Top controls and subtitle controls use the same primitive language as settings.

Final shape:

- Top panel is a solid surface.
- Header actions are shared icon buttons.
- Track selectors and transcription selectors are shared selects.
- Playback controls use shared icon button sizing and plain slider styling.
- Status banners use solid muted backgrounds and status-colored text only.
- No gradient progress bars.
- No glow or shadow emphasis.
- Pin, fullscreen, settings, play/pause, auto-hide, and transcription actions use consistent icon button styles.

Transcript body remains excluded.

## Browser Extension Popup

The extension popup uses the same visual grammar with native DOM.

Final shape:

- Header: status text plus icon buttons.
- Media records: list rows or flat repeated surfaces, no shadow cards.
- Connections: endpoint input, add/remove actions, connection statuses.
- Blacklist: match mode, pattern input, regex validation, add/remove.
- Appearance: segmented system/light/dark control.
- Drawers/panels use solid surfaces and one-pixel lines.
- Extension appearance storage remains independent from desktop settings.

The popup must not use:

- `usp-*` visual styles that conflict with desktop tokens.
- Pill buttons.
- Card shadows.
- Gradients.
- Feature-specific color palettes.

## CSS And Class Convergence

The final code should make it hard to reintroduce multiple visual systems.

Requirements:

- Shared tokens live in one desktop CSS root and one extension CSS root with matching names and meanings.
- Old feature-specific visual classes are removed, not preserved as fallback layers.
- Classes such as `fw-*`, `plugin-card__badge`, `btn-primary`, `btn-secondary`, `settings-surface`, and `usp-pill-button` do not drive final visual styling.
- Feature-specific classes may remain only for layout or test hooks when they do not define colors, shadows, borders, typography, or button/status behavior.
- CSS should be organized by tokens, primitives, layout, and feature layout hooks.

## Accessibility

- All icon-only controls have accessible names.
- Focus states are visible in light and dark modes.
- Status text is present; color is never the only signal.
- Form labels are explicit.
- Text fits in English and Chinese.
- Interactive targets remain practical for desktop and extension popup use.

## Testing And Verification

Required verification:

- Desktop renderer tests pass.
- Desktop typecheck passes.
- Extension tests pass.
- Extension build passes.
- Screenshot-sensitive transcript tests remain focused on unchanged transcript behavior.
- CSS scan confirms disallowed legacy visual classes do not remain as active styling.
- Light, dark, and system modes are checked for settings, plugin settings, top controls, word lookup chrome, and extension popup.

Visual acceptance criteria:

- A user should not be able to tell whether a setting belongs to host, transcription, word lookup, Jellyfin / Emby, or extension by its component styling.
- Repeated rows across profiles, plugins, transcription configs, servers, and media records should share the same visual language.
- No surface should appear elevated by shadow or decorative gradient.
- The UI should feel like one product, not multiple plugin demos embedded in one host.
