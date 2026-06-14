# Remove Reka UI With Local Primitives Design

## Goal

Remove `reka-ui` from the desktop renderer while preserving the existing custom UI experience through project-owned Vue primitives.

The final application has no `reka-ui` dependency, no `reka-ui` wrappers, no compatibility layer for old primitive implementations, and no transitional UI path. This project has not launched, so the final state can replace the old implementation directly.

## Final Dependency Shape

`@immersive-subs/desktop-app` no longer lists `reka-ui` in runtime dependencies.

The renderer UI primitive layer depends only on:

- Vue
- project-owned UI components and utilities
- browser DOM, pointer, keyboard, focus, and clipboard APIs
- existing project icons from `@lucide/vue`

The final renderer bundle must not contain `reka-ui`, `@floating-ui`, or `@vueuse` code unless another direct project dependency independently requires it.

## Architecture

The renderer keeps the existing `apps/desktop-app/src/renderer/components/ui` ownership boundary. Product screens continue importing controls from `../ui` or `../../ui`; those controls become complete local implementations.

Small shared DOM helpers may live under the UI component folder when they are used by more than one primitive. These helpers are project-specific, not a new general-purpose UI library. They cover only the behavior needed by the current desktop app:

- outside-pointer dismissal
- Escape-key dismissal
- fixed-position panel placement
- focus handoff between trigger and panel
- basic keyboard list navigation
- color value conversion for the existing color picker

Styling remains in the current renderer CSS. Existing public class names and `data-slot` attributes stay stable where product code or tests depend on them.

## UI Primitives

### UiSelect

`UiSelect` is a custom single-select control backed by a button trigger and a project-owned popover list.

Final behavior:

- string `modelValue`
- disabled options
- selected label and optional font-family preview
- check icon for the selected option
- custom dropdown chrome matching the current UI
- outside click closes the dropdown
- Escape closes the dropdown
- pointer opening focuses the trigger so keyboard navigation continues immediately
- Enter or Space selects the highlighted option
- ArrowUp, ArrowDown, Home, and End move highlight
- trigger exposes combobox-style accessibility state
- option rows expose stable `data-value` attributes for tests

The component does not support multi-select, grouped options, async option loading, virtualized lists, or generic form-library integration.

### UiSwitch

`UiSwitch` is a local switch control with the existing visual track and thumb.

Final behavior:

- boolean `modelValue`
- label text and optional hidden visual label behavior
- disabled state
- stable `role="switch"` and `aria-checked`
- keyboard toggle through native button semantics
- current `data-state` styling hooks

### UiTooltip

`UiTooltip` is a local lightweight tooltip.

Final behavior:

- wraps the existing default slot
- opens on hover and keyboard focus
- closes on pointer leave, blur, and Escape
- supports the existing `text`, `side`, `sideOffset`, and `delayDuration` props
- positions with simple viewport-aware fixed coordinates

The tooltip does not need full collision middleware, nested hoverable content, rich content, or animated presence management.

### UiColorInput

`UiColorInput` keeps the current visible color editing experience without `reka-ui`.

Final behavior:

- trigger button shows the color label using the selected color
- popover palette opens from the trigger
- saturation/brightness color area
- hue slider
- RGB channel inputs
- hex input
- partial hex text remains local while typing
- normalized lowercase `#rrggbb` values
- no three-digit hex shorthand support
- emits `update:modelValue` for live edits
- emits `change` for committed edits, even when the parent has already synced the live `update:modelValue`
- disabled and readonly states
- outside click and Escape close the palette

Color handling is local and limited to the formats used by this app. Pointer-drag calculations use the owned color-area and hue-slider elements directly, not runtime DOM queries through test selectors. The component does not become a general color library.

### UiSegmentedControl

`UiSegmentedControl` is a local button group with radiogroup semantics.

Final behavior:

- string `modelValue`
- disabled options
- selected styling through the existing `.is-selected` class
- `role="radiogroup"` on the root
- `role="radio"` and `aria-checked` on items
- click and keyboard selection
- arrow-key selection moves focus to the selected enabled item

### UiCheckIndicator

`UiCheckIndicator` is removed from the UI component source, barrel export, and UI primitive tests because no product screen consumes it.

Future product screens that need a circular check control can add a local primitive at that time. The final state does not keep an unused component solely to mirror the previous `reka-ui` surface.

## Data Flow

All primitives continue using Vue `v-model` conventions already used by product screens:

- `modelValue` with `update:modelValue` for select, switch, color input, and segmented control

No settings schema, persisted settings data, IPC contract, or extension contract changes are required. UI changes stay inside renderer primitives and their tests.

## Error Handling

Invalid UI input is normalized locally:

- unknown select values render the placeholder or empty selected label
- partial hex color strings remain local while editing, and invalid or incomplete hex text reverts to the current draft color on blur
- disabled controls ignore pointer and keyboard activation
- panel positioning falls back to the trigger's left edge and below-trigger placement when viewport calculations are unavailable

These states do not require global error reporting. They are local UI validation states.

## Accessibility

The final controls must preserve keyboard and assistive-technology usability for the current app surfaces.

Minimum requirements:

- select trigger is keyboard operable and exposes expanded state
- select trigger receives focus when a pointer opens the list
- select options expose selected and disabled state
- switch exposes `role="switch"` and `aria-checked`
- segmented control exposes radiogroup/radio semantics
- tooltip opens for keyboard focus as well as pointer hover
- color palette inputs have explicit labels
- Escape closes open overlays
- focus returns to the trigger after overlay dismissal when appropriate

## Testing

Final verification covers behavior, type safety, and bundle cleanup.

Required focused tests:

- UI primitive unit tests for select, switch, tooltip, color input, and segmented control
- settings profile browser tests that exercise font select, sliders, and color controls
- settings global tests that exercise language, theme, and switches
- top control panel tests that exercise tooltip and slider controls
- subtitle playback and track selector tests that exercise tooltip, slider, and select controls

Required repository checks:

- desktop renderer typecheck
- desktop app build
- desktop test suite
- repository test command after the UI primitive replacement

Bundle verification:

- generated renderer source maps do not list `node_modules/reka-ui`
- generated renderer source maps do not list `node_modules/@floating-ui` or `node_modules/@vueuse` unless another direct dependency is responsible
- `pnpm-lock.yaml` no longer contains `reka-ui` as a desktop app dependency

## Out Of Scope

This design does not introduce a new external UI library, a generic design system, a cross-framework primitive package, full WAI-ARIA combobox coverage beyond current needs, virtualized menus, rich tooltip content, or automated visual redesign.

It also does not preserve old primitive implementations, old wrapper names that no product code needs, or compatibility behavior for unpublished builds.
