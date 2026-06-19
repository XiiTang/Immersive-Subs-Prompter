# Window Rounded Corners Design

## Goal

The desktop app's main window and settings window have rounded visible outer corners on macOS, Windows, and Linux packaged builds.

The final product shape is the only concern of this spec. It intentionally does not document intermediate modification steps. The project has not launched, so the design does not include compatibility code, migration paths, legacy-window behavior, or fallback layers for old state.

## Reference Projects

| Reference | What It Contributes | Decision For This Project |
| --- | --- | --- |
| `/Users/cq-laptop/Projects/referrence projects/cherry-studio` | Primary reference for app-window platform boundaries. Its main window is an opaque native app surface with macOS hidden titlebar, Windows `frame: false`, Linux frame controlled by app preference, and runtime Windows Mica/background handling. Its settings window is also opaque and native-backed. Its floating selection toolbar is the explicit transparent rounded-window example: `frame: false`, `transparent: true`, `hasShadow: false`, `thickFrame: false`, `roundedCorners: true`, and a renderer toolbar radius of `10px`. | Use Cherry Studio as the primary reference for platform intent and radius scale. Do not import its broader window registry, Mica, vibrancy, or settings sizing architecture because this project's current window model is smaller and already uses transparent frameless surfaces. |
| `/Users/cq-laptop/Projects/referrence projects/open-design/apps/desktop` | `createDesktopPetWindow()` uses a transparent frameless floating carrier: `frame: false`, `transparent: true`, `backgroundColor: "#00000000"`, `hasShadow: false`. | This is the closest reference for the current main window, which is already a transparent overlay rather than a full opaque app shell. |
| `/Users/cq-laptop/Projects/referrence projects/AionUi/packages/desktop` | Pet windows use the same transparent frameless carrier model. The project also documents a Windows resize issue for transparent frameless windows. | Use as supporting evidence for the transparent overlay pattern. Resize behavior is outside this design because this request is limited to the final rounded boundary shape. |

## Final State Summary

| Area | Current State | Final State |
| --- | --- | --- |
| Shared radius | The app has component radii from shared UI tokens, but no explicit window-boundary radius. | The desktop renderer owns a single window boundary radius token set to `10px`, matching Cherry Studio's transparent floating toolbar radius. |
| Main BrowserWindow | The main window is already a frameless transparent carrier with `frame: false`, `transparent: true`, `backgroundColor: "#00000000"`, `hasShadow: false`, and hidden titlebar. | Keep the transparent overlay carrier. Explicitly request rounded frameless corners where Electron supports it, but make the renderer clipping the authoritative visible shape. |
| Main visible surface | `.top-control-panel__surface` paints a full-width rectangular background with `border-radius: 0`. | The top control panel is the main window's visible shell. It uses the shared `10px` window radius and clips all painted content inside that radius in both expanded and collapsed states. |
| Settings BrowserWindow | The settings window paints an opaque `backgroundColor: "#101418"` at the native window level, so the rectangular carrier remains visible around the renderer. | The settings BrowserWindow is a transparent carrier. It does not paint a native rectangular background behind the renderer shell. Native controls and drag behavior remain equivalent to the current settings window. |
| Settings renderer shell | `.settings-window` paints the full viewport background and `.settings-window-shell` clips content with rectangular corners. | The renderer shell is the only visible settings background. It fills the viewport, uses the shared `10px` outer radius, clips all child content, and preserves the existing fixed settings size and two-column layout. |
| Windows packaging | Windows currently relies on BrowserWindow options and the settings `titleBarOverlay` while still allowing a rectangular native background to be visible. | Packaged Windows builds use the same transparent carrier plus renderer shell boundary as macOS. Electron `roundedCorners` may help on supported Windows versions, but final visual correctness does not depend on native rounded corners. |
| Linux packaging | Linux cannot rely on Electron's `roundedCorners` option, and native frame behavior is not a cross-platform rounded-corner guarantee. | Packaged Linux builds use the renderer shell as the visible rounded boundary. The final state does not fall back to a square native frame for these two windows. |

## Window Boundary Contract

The main process owns the invisible carrier window. The renderer owns the visible window boundary.

Carrier-window responsibilities:

- Allow transparency around the renderer shell.
- Avoid painting an opaque native rectangle behind the renderer.
- Preserve existing window lifecycle, sizing, always-on-top, fullscreen, settings-open, and preload behavior.
- Preserve current settings-window control and drag affordances.
- Request Electron frameless rounded corners on platforms where the option exists.

Renderer-shell responsibilities:

- Paint the only visible window background.
- Apply the shared `10px` radius at the outermost visible shell.
- Clip child backgrounds, borders, scroll regions, headers, and hover states inside the rounded outline.
- Keep existing internal component radii unchanged unless they are part of the outer shell.
- Keep root/body areas outside the rounded shell transparent.

The Electron `roundedCorners` option is not the source of truth because it is platform-limited. It is allowed as a native hint; the visible rounded shape must still come from the renderer shell.

## Main Window Final Shape

The main window remains a transparent frameless overlay. It does not adopt Cherry Studio's full native app-window architecture, vibrancy, Mica, window registry, or opaque background model.

The visible main-window boundary is the top control panel surface:

- The top control panel uses the shared `10px` radius.
- The panel surface keeps `overflow: hidden` so all header, body, status, slider, and selector backgrounds stay inside the rounded shape.
- The collapsed state moves the same rounded surface as one block; it does not introduce a second rectangular clipped layer.
- The root `.window` stays transparent and clips descendants consistently with the visible shell.
- The existing transparent subtitle area remains transparent outside the panel and does not paint a square background.

## Settings Window Final Shape

The settings window becomes a transparent carrier with a renderer-owned shell.

The final settings shell:

- Fills the fixed settings viewport.
- Uses the same `10px` outer radius as the main top panel.
- Clips the header, navigation rail, content scroll region, borders, and section backgrounds inside the rounded outline.
- Keeps the existing settings dimensions, non-resizable behavior, header drag region, control no-drag regions, settings navigation, and scroll behavior.
- Does not add a second inner card around the existing settings layout.

The native BrowserWindow background is transparent. The settings renderer shell, not `BrowserWindow.backgroundColor`, owns the visible dark/light background.

## Platform Contract

| Platform | Final Behavior |
| --- | --- |
| macOS | Both windows present renderer-clipped rounded shells inside transparent carriers. Native rounded-corner support can be enabled, but renderer clipping remains the visible contract. |
| Windows | Main and settings packaged windows do not expose a square native background. Windows Control Overlay behavior for the settings window remains equivalent to the current settings chrome. Native `roundedCorners` is a hint, not the visual guarantee. |
| Linux | The final visible border is renderer-clipped. Linux does not rely on Electron native rounded-corner support or a native square frame for these two windows. |

## Out Of Scope

- Introducing Cherry Studio's full window registry abstraction.
- Adding Cherry Studio's vibrancy, visual-effect, Mica, or background-material system.
- Changing settings window size, position, route behavior, or page structure.
- Redesigning settings titlebar controls; current control affordances remain equivalent.
- Adding old-shape compatibility, migration, or legacy fallback paths.

## Acceptance Criteria

| Requirement | Acceptance Criteria |
| --- | --- |
| Main window rounded boundary | The main top control panel no longer has `border-radius: 0`; its visible shell uses the shared `10px` window radius and clips child content. |
| Settings window rounded boundary | The settings window no longer paints an opaque native rectangular background; the renderer shell is the only visible settings background and uses the shared `10px` outer radius. |
| Shared radius | Main and settings outer window shells use the same radius token/value. |
| Transparent outside corners | Areas outside the rounded shell are transparent in the renderer and carrier window. |
| Existing interactions preserved | Main auto-hide, drag regions, settings navigation, settings scroll regions, and settings controls behave as before. |
| Windows packaging aligned | Windows builds use the same transparent-carrier/renderer-shell boundary model and do not depend on a square native frame. |
| Linux packaging aligned | Linux builds use renderer clipping for the final visible boundary and do not depend on unsupported native rounded-corner behavior. |
| No compatibility layer | The implementation changes current code directly to the final shape without migration, legacy, or fallback code for old square-window behavior. |

## Required Test Coverage

| Test Area | Required Coverage |
| --- | --- |
| Main renderer CSS | Assert the main window and top control panel surface use the shared rounded-window radius and no longer assert square borders. |
| Main control panel behavior | Existing expanded, collapsed, draggable, and auto-hide tests continue to pass with the rounded surface. |
| Settings BrowserWindow options | Assert the settings BrowserWindow no longer paints an opaque native rectangle behind the renderer shell and still preserves fixed size and non-resizable behavior. |
| Settings renderer CSS | Assert the settings root/shell uses the shared rounded-window radius, clips overflow, and keeps drag/no-drag region rules intact. |
| Platform options | Assert Windows-specific settings-window titlebar overlay behavior remains present where it already exists, while the carrier background remains transparent. |
| Final-state cleanup | Assert no test or style rule still requires `border-radius: 0` for the main or settings outer window boundary. |
