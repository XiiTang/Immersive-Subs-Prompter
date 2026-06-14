# Renderer UI Foundation Design

## Goal

Establish a project-owned renderer UI foundation for the desktop app.

The final desktop renderer has one approved UI foundation under `apps/desktop-app/src/renderer/components/ui`. All new renderer interfaces use this foundation. All existing renderer interfaces are expressed through this foundation where they use shared controls, form patterns, chrome, status presentation, overlay behavior, or common layout primitives.

The project has not launched. The final state does not preserve legacy UI implementations, transitional wrappers, duplicated style systems, compatibility aliases, or old component APIs that are no longer used by the final renderer.

## Final Dependency Shape

The desktop renderer UI foundation depends only on:

- Vue
- project-owned renderer components and utilities
- browser DOM, pointer, keyboard, focus, and clipboard APIs
- existing icons from `@lucide/vue`

The final renderer does not add Ant Design, Arco Design, Element Plus, Naive UI, Vuetify, shadcn-vue, Reka UI, Radix UI, Tailwind CSS, UnoCSS, Bootstrap, Material UI, Chakra UI, Mantine, Fluent UI, or another runtime UI/style framework.

The renderer may keep general-purpose non-UI dependencies that are already required by product behavior. Those dependencies do not become styling or component ownership boundaries.

## Architecture

`apps/desktop-app/src/renderer/components/ui` is the only shared UI foundation boundary for renderer code.

The UI foundation exports stable Vue components, small renderer-only utilities, and documented class patterns. Product components import from the UI foundation instead of creating local button, input, field, list, card, badge, status, overlay, or toolbar variants.

The final renderer CSS is organized around three layers:

- design tokens on `:root` and theme selectors
- shared UI foundation classes owned by `components/ui`
- product-specific layout classes that do not restyle shared controls

Product-specific classes may control placement, grid structure, panel geometry, text projection, transcript rendering, subtitle typography, and other domain-specific layout. They do not redefine shared control chrome such as button borders, input focus rings, disabled opacity, select dropdown surfaces, switch tracks, slider thumbs, field labels, badge tones, status rows, or common list item treatment.

## Design Tokens

The final token set covers every shared visual decision used by the renderer:

- color: background, surface, elevated surface, muted surface, text, muted text, border, accent, success, warning, danger, info
- typography: font families, body size, compact size, label size, heading sizes, weight scale, line height
- spacing: compact, default, and section spacing values
- radius: small control radius, default surface radius, pill radius
- borders and focus: border color, focus ring color, focus ring width, focus offset
- elevation: overlay shadow, floating panel shadow, modal/dialog shadow
- z-index: tooltip, popover, dropdown, floating window chrome, modal
- motion: hover/focus transition duration and easing
- state: disabled opacity, active background, selected background, error color

Light and dark themes use the same token names. Components consume tokens rather than hard-coded theme-specific colors, except for content-specific previews such as subtitle color swatches.

## Foundation Components

The final foundation contains these component groups.

### Actions

- `UiButton`
- `UiIconButton`
- icon plus text action pattern
- destructive, primary, secondary, ghost, and compact variants
- loading/disabled states where product screens need them

Buttons have stable height, spacing, icon sizing, focus, hover, active, disabled, and text overflow behavior.

### Forms

- `UiInput`
- `UiTextarea`
- `UiSelect`
- `UiSwitch`
- `UiSlider`
- `UiSegmentedControl`
- `UiColorInput`
- `UiField`
- inline control pattern
- validation/error pattern

Form controls share label placement, hint text, value text, error presentation, focus rings, disabled behavior, compact sizing, and full-width behavior.

### Feedback

- `UiStatus`
- `UiBadge`
- `UiProgress`
- `UiEmptyState`
- inline error and warning text

Feedback components use a single tone system. Tone names map to tokenized colors and do not allow per-screen ad hoc status palettes.

### Structure

- `UiSection`
- `UiListItem`
- settings row pattern
- grouped field pattern
- dense toolbar pattern
- scrollable content surface pattern

Structural components define spacing, borders, section headers, list density, and repeated row behavior. Product screens provide domain content, not their own repeated chrome.

### Overlays

- `UiTooltip`
- dropdown/select panel positioning helpers
- popover behavior for color input and compact floating controls
- outside-pointer dismissal
- Escape-key dismissal
- focus return rules

Overlay behavior is project-owned and limited to current renderer needs. The final foundation does not become a general-purpose UI library.

## Final Renderer Surfaces

### Settings Window

The settings window is fully expressed through the UI foundation for shared controls and repeated structure.

Final settings surfaces use:

- `UiSection` or the settings section pattern for each settings group
- `UiField` or the settings row pattern for labels, hints, values, validation, and controls
- foundation buttons for all actions
- foundation icon buttons for compact actions
- foundation lists for profiles, plugins, endpoints, and pill editors where applicable
- foundation badges/status/progress for plugin, cache, update, and error states
- foundation select, switch, slider, input, textarea, segmented control, and color input components

The final settings code does not keep custom local button/input/select/switch/slider styles. Local classes may control settings-specific layout such as split panes, editor width, responsive wrapping, preview placement, and plugin schema grid structure.

### Top Control Panel

The top control panel uses the foundation for all shared UI chrome.

Final top-panel surfaces use:

- foundation icon buttons for collapse, pin, close, and tool actions
- foundation slider for opacity and playback-like numeric controls
- foundation status and badge patterns for connection, profile, video, and transcription state
- foundation select/dropdown behavior where the panel exposes track or mode choices
- foundation tooltip behavior for icon-only controls

Panel geometry, drag handles, edge trigger zones, collapsed offsets, and window-specific hit areas remain top-panel-owned layout behavior.

### Subtitle Window

The subtitle window keeps domain-specific transcript and subtitle rendering while sharing all reusable UI controls.

Final subtitle surfaces use:

- foundation controls for playback buttons, auto-hide toggles, track selectors, transcription actions, status banners, and sliders
- foundation tooltip behavior for icon-only subtitle controls
- foundation status/error presentation for loading, missing media, connection, transcription, and cache states

Transcript projection, active cue highlighting, word lookup token rendering, AB loop affordances, cue rail geometry, and subtitle text styling remain subtitle-domain code. They consume tokens where they need common colors, focus, state, or spacing.

### Word Lookup Window

The word lookup window keeps dictionary-content layout while using foundation chrome for shared behavior.

Final word-lookup surfaces use:

- foundation window action buttons
- foundation status and empty-state presentation
- foundation scroll/resize visual patterns where applicable
- tokenized surface, border, shadow, focus, and text colors

Dictionary entry layout, token matching, aliases, and content typography remain word-lookup-domain code.

## Data Flow

The UI foundation uses Vue conventions already used by the renderer:

- `modelValue` and `update:modelValue` for controlled values
- `change` events for committed edits where product logic distinguishes live edits from committed edits
- explicit props for `disabled`, `readonly`, `error`, `hint`, `label`, `size`, `variant`, and `tone`
- stable slot names for action content, labels, metadata, and descriptions

UI foundation components do not own persisted settings, IPC contracts, plugin contracts, subtitle state, cache state, release state, or extension contracts. Product stores and IPC handlers remain the source of product data. Foundation components receive values and emit user intent.

## Error Handling

UI input errors are local presentation states unless a product workflow already has domain-level error handling.

Final behavior:

- invalid field values show foundation error text and error state
- disabled controls ignore pointer and keyboard activation
- readonly controls present values without emitting edits
- unavailable action buttons expose disabled state and explanatory tooltip or hint when useful
- overlay positioning falls back to stable below-trigger placement when viewport calculations are unavailable
- invalid color input reverts to the current valid draft on blur
- unknown select values render the placeholder or empty label

The UI foundation does not log global errors for local validation states. Product workflows continue to own domain failures such as IPC errors, plugin install failures, update check failures, cache failures, transcription failures, and network failures.

## Accessibility

The final foundation provides the accessibility baseline for renderer UI:

- buttons use native button semantics
- icon-only buttons require accessible labels
- switches expose `role="switch"` and `aria-checked`
- segmented controls expose radiogroup/radio semantics
- selects expose expanded, selected, disabled, and option state
- tooltips open on keyboard focus as well as pointer hover
- form fields connect labels, hints, errors, and controls through stable ARIA attributes
- Escape closes open overlays
- focus returns to the trigger after overlay dismissal where appropriate
- focus rings are visible in light and dark themes
- disabled and readonly states are visually and semantically distinct where the native element supports it

## Styling Rules

Final renderer styling follows these rules:

- shared control styling lives in the UI foundation layer
- product files do not define new control chrome for common controls
- product files do not hard-code theme colors when a token exists
- product files do not duplicate focus, hover, disabled, selected, or active state rules for shared controls
- repeated layout patterns become foundation structure components or documented foundation class patterns
- single-use domain layout may stay local when it is not a reusable UI primitive
- CSS class names stay descriptive and scoped by ownership
- `data-slot` attributes remain stable for foundation components and tests

## Testing

Final verification covers behavior, type safety, visual consistency, and dependency boundaries.

Required focused tests:

- UI foundation component tests for actions, forms, feedback, structure, and overlays
- settings browser/jsdom tests covering profile editing, global settings, plugin settings, release update state, endpoint editing, shortcut editing, cache controls, and color/style controls
- top control panel tests covering action buttons, tooltips, status presentation, sliders, track controls, and collapsed/expanded states
- subtitle tests covering playback controls, track selection, status banners, transcription controls, cue action controls, and word lookup entry points
- word lookup tests covering window chrome, empty states, scroll/resize behavior, and dictionary content rendering

Required repository checks:

- desktop renderer typecheck
- desktop app build
- desktop test suite
- repository test command

Required dependency checks:

- no runtime dependency on Ant Design, Arco Design, Element Plus, Naive UI, Vuetify, shadcn-vue, Reka UI, Radix UI, Tailwind CSS, UnoCSS, Bootstrap, Material UI, Chakra UI, Mantine, or Fluent UI
- no renderer source imports from external UI/style frameworks
- no duplicated legacy UI component barrel exports

## Out Of Scope

This design does not introduce an external UI library, a cross-application design system package, a public component library, a generic overlay engine, virtualized menus, rich tooltip content, a theme marketplace, or compatibility behavior for unpublished builds.

This design does not preserve old renderer UI code for historical behavior. The final state is the source of truth.
