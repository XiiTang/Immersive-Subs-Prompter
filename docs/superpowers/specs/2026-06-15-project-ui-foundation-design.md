# Project UI Foundation Design

## Goal

Establish one project-level frontend style foundation shared by the desktop renderer and the browser extension popup.

The final project has a single source of truth for shared design tokens, base CSS, and cross-surface primitive `.ui-*` chrome. The desktop renderer continues to use Vue components for behavior and accessibility. The extension popup continues to use native HTML and TypeScript. Both surfaces consume the same CSS foundation.

The project has not launched. The final state does not preserve duplicate local style systems, compatibility aliases, transitional shims, or old unpublished UI contracts.

## Final Architecture

`packages/ui` is the only package that owns shared frontend visual foundations.

The package is named `@immersive-subs/ui` and exposes a CSS entrypoint for app consumers:

```text
packages/ui/
  package.json
  src/
    tokens.css
    base.css
    primitives.css
    index.css
  tests/
    ui-css-contract.test.mjs
```

`src/index.css` imports the layers in this order:

1. `tokens.css`
2. `base.css`
3. `primitives.css`

Application-specific styles load after `@immersive-subs/ui/index.css`. Product styles may control layout, geometry, and domain rendering, but they do not redefine shared primitive chrome.

## Ownership Boundaries

### Shared UI Package

`packages/ui` owns:

- shared `--ui-*` design tokens
- global box sizing and form-control font inheritance
- shared focus-visible and disabled-state treatment
- cross-surface primitive classes under `.ui-*`
- primitive variants that are used by more than one frontend surface or intentionally belong to the shared project UI language

The shared package does not own product state, settings data, IPC contracts, browser-extension contracts, subtitle rendering logic, popup messaging, or Vue component behavior.

### Desktop Renderer

`apps/desktop-app/src/renderer` owns:

- Vue UI components under `components/ui`
- ARIA wiring, keyboard behavior, popovers, tooltips, custom select behavior, color input behavior, and component events
- settings window layout
- top panel layout
- subtitle projection and transcript layout
- word lookup window layout
- desktop-only CSS variables such as panel opacity and window geometry controls
- desktop-only `.ui-*` component internals for select popovers, tooltips, color input, fields, sections, surfaces, toolbars, setting rows, stats, groups, scrollbars, resize handles, and desktop-only Vue component variants

Desktop Vue components use shared primitive `.ui-*` class names from `@immersive-subs/ui` for cross-surface controls and feedback. Desktop-only component internals keep their CSS in the renderer instead of becoming shared package primitives.

### Extension Popup

`apps/extension` owns only popup-specific frontend layout:

- popup fixed dimensions
- popup header and settings drawer layout
- media row layout
- server endpoint editor layout
- blacklist editor layout
- popup list-container layout
- popup-specific i18n hooks and DOM generation

The extension popup remains native `popup.html` plus `src/popup.ts`. It does not use Vue, does not import desktop renderer components, and does not define its own shared primitive chrome.

Content scripts, background scripts, manifest generation, and future injected page UI are outside this design.

## Shared Tokens

`tokens.css` defines the shared project UI token contract:

- color: `--ui-bg`, `--ui-surface`, `--ui-surface-muted`, `--ui-text`, `--ui-text-muted`, `--ui-border`, `--ui-accent`, `--ui-success`, `--ui-warning`, `--ui-danger`, `--ui-info`
- typography: project font stack, root UI font size, `--ui-font-sm`, `--ui-font-md`, `--ui-font-lg`
- spacing: `--ui-space-1`, `--ui-space-2`, `--ui-space-3`, `--ui-space-4`, `--ui-space-6`
- radius: `--ui-radius`, `--ui-radius-sm`
- elevation: `--ui-shadow-floating`

Dark theme token values are defined by the shared package through `:root[data-theme="dark"]`. Product-specific status colors may exist outside `--ui-*` only when they describe product state rather than shared UI semantics.

## Shared Primitives

`primitives.css` defines the shared visual chrome for:

- `.ui-button`
- `.ui-icon-button`
- `.ui-input`
- `.ui-textarea`
- `.ui-select`
- `.ui-switch`
- `.ui-slider`
- `.ui-segmented`
- `.ui-status`
- `.ui-badge`
- `.ui-message`
- `.ui-empty-state`
- `.ui-progress`
- `.ui-list-item`
- `.ui-chip`
- `.icon`

The package also owns primitive density and intent variants such as `sm`, `md`, `xs`, `compact`, `chip`, `bare`, `block`, `primary`, `secondary`, `ghost`, `danger`, `success`, `warning`, `info`, and `neutral` where those variants are part of the shared UI language.

Desktop-only `.ui-*` classes such as `.ui-button--editable`, `.ui-button--nav`, `.ui-select-content`, `.ui-tooltip`, `.ui-color-input`, `.ui-field`, `.ui-section`, `.ui-surface`, `.ui-toolbar`, `.ui-setting-row`, `.ui-inline-control`, `.ui-stat`, `.ui-group`, `.ui-scrollbar`, and `.ui-resize-handle` are renderer component internals, not shared primitives. Product list containers such as the desktop profile list and extension media root use product classes, not a shared `.ui-list` helper.

Product styles may compose shared primitive classes with product layout classes. Product styles do not set primitive border, background, color, radius, focus outline, font size, line height, or disabled chrome for product classes that are composed with shared primitives. Direct shared primitive selectors also do not receive product-owned padding, width, or height rules.

## Build Shape

The root workspace includes `packages/ui` as a first-class package.

Root scripts include the UI package in build, typecheck, and test flows. The UI package does not require a runtime JavaScript bundle; CSS source files are the source of truth and can be consumed directly through the package export.

The desktop renderer loads `@immersive-subs/ui/index.css` before desktop product CSS.

The extension build resolves `@immersive-subs/ui/index.css`, expands that entrypoint's CSS imports, and emits one final `popup.css` per browser target. That output contains shared UI CSS first and popup-specific layout CSS second. The extension source tree does not keep a second token or primitive stylesheet.

## Boundary Enforcement

The existing renderer-only UI boundary check becomes a project UI boundary check.

The boundary check passes only when:

- `packages/ui` is the only source that defines shared `--ui-*` tokens
- `packages/ui` is the only source that defines shared primitive `.ui-*` chrome
- desktop product CSS does not override shared primitive chrome
- desktop product CSS does not redefine shared primitive chrome through product classes composed with shared primitives
- extension popup layout CSS does not define shared tokens or primitive chrome
- extension popup layout CSS does not redefine shared primitive chrome through product classes composed with shared primitives
- desktop and extension source do not import external UI or style frameworks
- built extension popup CSS includes required shared token and primitive markers before popup layout CSS

The root test command builds the extension popup CSS for both browser targets before running the boundary check.

## Error Handling

Style foundation failures are build and test failures, not runtime fallbacks.

The extension build fails if it cannot read the shared UI CSS entrypoint or cannot write a popup stylesheet containing the shared foundation. The UI package test fails if `index.css` does not include tokens, base, and primitives in the required order. The boundary check fails if either frontend surface reintroduces duplicate primitive definitions.

No fallback CSS is shipped for missing shared UI styles.

## Testing

The final verification surface includes:

- `packages/ui` CSS contract tests for token, base, primitive, and import-order presence
- `packages/ui` CSS contract tests proving desktop-only component internals, product list containers, and desktop-only variants are not shared primitives
- project UI boundary tests for allowed and blocked ownership patterns
- existing desktop renderer component tests for Vue component DOM, ARIA, events, and class contracts
- existing extension popup tests for i18n and DOM behavior
- root script tests proving built `popup.css` contains required shared token and primitive markers before popup layout
- root `pnpm test`
- root `pnpm typecheck`
- root `pnpm build`

Broad build and test success is not the only proof of completion. Source checks must show that cross-surface shared UI chrome lives in `packages/ui`, desktop-only component internals live in the renderer, and product surfaces do not override shared primitive chrome.

## Explicit Non-Goals

This design does not:

- move the extension popup to Vue
- introduce Tailwind CSS, UnoCSS, Reka UI, Radix UI, Ant Design, Arco Design, Element Plus, Naive UI, Vuetify, Material UI, Chakra UI, Mantine, Fluent UI, or another runtime UI/style framework
- create compatibility layers for old unpublished styles
- preserve duplicate desktop or extension shared primitive CSS
- design future content-script injected UI
- change browser-extension messaging, manifest semantics, release artifacts, IPC contracts, settings storage, subtitle logic, or media detection behavior

## Acceptance Criteria

The final project-level UI foundation is complete when:

- `packages/ui` is the only owner of shared tokens, base CSS, and cross-surface primitive CSS
- desktop renderer components consume shared primitive CSS while preserving their current behavior and accessibility contracts
- desktop-only component internals stay in renderer CSS rather than the shared package
- extension popup consumes the shared CSS foundation without adopting Vue
- desktop and extension product styles contain only product layout and domain rendering rules
- project UI boundary checks are enforced by root tests
- root test, typecheck, and build commands pass
