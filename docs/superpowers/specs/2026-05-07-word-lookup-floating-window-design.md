# Word Lookup Floating Window Design

Date: 2026-05-07

## Summary

The word lookup panel is a transient Electron floating window. It can extend outside the subtitle window while staying inside the current display work area. The panel appears from modifier-hover lookup on subtitle text and remains visible only while the pointer moves from the trigger word into the panel or stays inside the panel.

The project has not shipped yet. The implementation targets this final shape directly and does not need to preserve, migrate, or keep compatibility with old word lookup panel data, interim renderer-only code paths, or previous interaction behavior.

## Goals

- Allow the word lookup panel to extend beyond the subtitle BrowserWindow.
- Keep the panel constrained to the current display work area.
- Prefer positioning the panel at the trigger word's lower-right side.
- Place the panel at the trigger word's lower-left side when the lower-right placement would overflow the work area horizontally.
- Keep the panel transient: it is shown for the current lookup and closes when the pointer leaves the panel flow.
- Preserve the existing modifier-hover lookup trigger and word-list lookup behavior.
- Keep the subtitle view silent on lookup misses and floating-window failures.

## Non-Goals

- Do not make the word lookup panel a persistent dictionary window.
- Do not support dragging the panel outside the subtitle window and keeping it there.
- Do not add click, double-click, or pure-hover lookup triggers.
- Do not close the panel with Escape.
- Do not define a user-facing "next word replaces previous panel" interaction.
- Do not remember panel position.
- Do not migrate or preserve previous internal word lookup panel implementations.

## User Experience

Lookup is triggered by the existing configured modifier key plus hovering a subtitle token. If the token matches the user's word list, a floating word lookup panel appears near that token.

The panel defaults to the token's lower-right side with an 8 px gap. If that placement would overflow the current display work area to the right, the panel appears at the token's lower-left side. The panel may cross the subtitle window boundary, but its bounds are clamped to the display work area so it does not disappear under the menu bar, Dock, taskbar, or screen edge.

The panel's lifetime follows pointer movement:

- Moving from the subtitle token into the lookup panel keeps the panel visible.
- Scrolling, selecting text, or clicking links inside the panel keeps it visible.
- Leaving the lookup panel closes it.
- Leaving the trigger token without entering the lookup panel closes it after a 200 ms handoff delay.
- The handoff delay covers the physical gap between the subtitle window and the floating lookup window.
- Trigger-token leave is matched by the hovered token instance, not only by word text, so repeated identical words do not close the wrong lookup flow.

The panel remains resizable and scrollable. The visible scrollbar is a custom overlay thumb that appears during scroll or drag activity and auto-hides after inactivity; the browser-native scrollbar is not exposed visually. Resizing is controlled from the panel's lower-right handle, updates the Electron floating window size immediately, and stores only the panel size in the existing word lookup plugin configuration.

## Architecture

The feature is split across three units.

`SubtitleView`

- Tracks modifier-hover on subtitle tokens.
- Calls the existing word lookup command.
- Sends a floating-window open request only when lookup results contain matches.
- Sends the trigger token rectangle in subtitle-window coordinates.
- Sends a trigger-leave event when the pointer leaves the token that opened the panel.
- Does not render the lookup panel DOM inside the subtitle window.

`WordLookupWindowManager`

- Lives in the main process.
- Owns the transient lookup BrowserWindow lifecycle.
- Converts the trigger token rectangle from subtitle-window coordinates to screen coordinates.
- Computes floating-window bounds from panel size, token rectangle, and display work area.
- Opens, positions, shows, and destroys the lookup window.
- Closes the lookup window when the subtitle window hides, minimizes, closes, or is destroyed.
- Mirrors the subtitle window's always-on-top behavior.

`WordLookupWindow`

- Is a dedicated renderer page for the floating lookup panel.
- Receives sanitized lookup payloads from the main process.
- Renders the existing safe Markdown subset.
- Handles internal scrolling, text selection, external links, and resize events.
- Uses a hidden native scroll container with a custom auto-hiding scrollbar overlay.
- Provides the lower-right resize handle used to resize the floating BrowserWindow.
- Reports pointer enter, pointer leave, and explicit resize-handle drag updates to the main process.
- Does not report passive mount or window resize events back as panel-size changes.

## Window Behavior

The floating lookup window uses these Electron window characteristics:

- Frameless.
- Transparent background.
- Resizable.
- Hidden from the taskbar.
- No long-lived position persistence.
- No keyboard Escape close behavior.
- External links open through the existing system-browser IPC path.
- The lookup window does not navigate itself to word-list links.
- The visible scrollbar is custom-rendered and auto-hiding.
- The lower-right resize handle remains inside the panel so resizing does not depend on a frameless-window native border.

The floating lookup window follows the subtitle window's stacking intent. When the subtitle window is always on top, the lookup window is also always on top at the same level. When the subtitle window is not always on top, the lookup window is shown as a transient window above the subtitle window.

## Positioning

Positioning uses screen coordinates and the display work area for the display containing the trigger point. If the trigger point cannot be resolved, positioning falls back to the display matching the subtitle window bounds.

Inputs:

- Trigger token rectangle in subtitle-window coordinates.
- Subtitle window bounds in screen coordinates.
- Saved panel width and height.
- Minimum panel width and height.
- Current display work area.
- 8 px gap between token and panel.

Rules:

1. Convert token rectangle to screen coordinates by adding subtitle window `x` and `y`.
2. Try lower-right placement:
   - `left = token.right + gap`
   - `top = token.bottom + gap`
3. If lower-right placement overflows the work area on the right, use lower-left placement:
   - `left = token.left - panel.width - gap`
   - `top = token.bottom + gap`
4. Clamp `left` so the full panel remains inside the work area's left and right edges.
5. Clamp `top` so the full panel remains inside the work area's top and bottom edges.
6. Clamp panel size so it is not larger than the available work area minus margins.

Lower-left fallback is only selected for horizontal right overflow. Vertical overflow is handled by clamping `top` within the work area.

## IPC Contract

Renderer-to-main commands:

- `word-lookup-window:open`
  - Payload: matches, anchor rectangle, desired panel size.
  - Result: success flag. Failures are silent in the subtitle UI.
- `word-lookup-window:pointer-enter`
  - Cancels any pending handoff close.
- `word-lookup-window:pointer-leave`
  - Closes the lookup window.
- `word-lookup-window:trigger-leave`
  - Starts the handoff close delay unless the pointer has already entered the lookup window.
- `word-lookup-window:resize`
  - Payload: panel width and height.
  - Resizes the current floating BrowserWindow and persists the clamped panel size in the word lookup plugin config.
- `word-lookup-window:open-external`
  - Payload: URL.
  - Uses the existing external-link handling policy.

Main-to-lookup-window events:

- Initial lookup payload for rendering matches.

## Error Handling

If the subtitle window is missing, destroyed, hidden, minimized, or has invalid bounds, the lookup window does not open.

If the lookup payload is invalid, empty, or too large for the supported panel contract, the lookup window does not open.

If positioning cannot resolve a display work area, the main process uses Electron's nearest display for the subtitle window bounds.

If the lookup window fails to load or its renderer crashes, the main process destroys that window and logs the failure. The subtitle window continues running.

Lookup misses remain silent and do not open a panel.

## Security

The lookup window uses context isolation and no Node integration.

Word-list Markdown continues to render through the safe Markdown renderer:

- Raw HTML is escaped.
- Only supported Markdown constructs are rendered.
- Only `http` and `https` links are clickable.
- Link clicks do not navigate the lookup window.

The lookup window accepts only structured lookup payloads from the main process. It does not read word-list files directly.

## Testing

Main-process tests:

- Bounds conversion from subtitle-window coordinates to screen coordinates.
- Lower-right placement inside the work area.
- Lower-left fallback when lower-right overflows horizontally.
- Top and bottom clamping.
- Panel size clamping to work area.
- Multi-display work-area selection.
- Closing on subtitle window hide, minimize, close, and destroy.
- Always-on-top behavior follows the subtitle window setting.

Renderer tests:

- Modifier-hover lookup still opens the floating window only on matches.
- Lookup misses remain silent.
- No lookup panel DOM is rendered in the subtitle DOM.
- The lookup window renders headings, lists, links, code, blockquotes, and tables.
- Raw HTML remains escaped.
- Link clicks use external-link IPC.
- Resize emits panel size updates.
- Custom scrollbar appears during scroll or thumb drag and hides after inactivity.
- Custom scrollbar thumb drag changes the panel scroll position.
- Lower-right resize handle updates the floating BrowserWindow size.
- Escape does not close the lookup window.
- Pointer enter cancels pending handoff close.
- Pointer leave closes the lookup window.

End-to-end behavior checks:

- A lookup near the subtitle window edge can appear outside the subtitle window.
- A lookup near the right edge of the display appears on the token's lower-left side.
- Moving from the trigger word into the panel keeps the panel visible.
- Leaving the panel closes it.
- Moving away from the trigger word without entering the panel closes it after the handoff delay.

## Acceptance Criteria

- A matching modifier-hover lookup opens a transient Electron floating window.
- The floating panel can extend outside the subtitle window.
- The floating panel remains inside the current display work area.
- Lower-right placement is used by default.
- Lower-left placement is used when lower-right placement would overflow the work area horizontally.
- The panel stays open when the pointer enters and remains inside it.
- The panel closes when the pointer leaves it.
- The panel closes when the pointer leaves the trigger word and does not enter the panel within the 200 ms handoff delay.
- Escape does not close the panel.
- The panel remains resizable and scrollable.
- The panel uses a small custom auto-hiding scrollbar rather than a visible native scrollbar.
- The panel can be resized from the lower-right handle without closing during the drag.
- Resizing persists panel size only.
- Lookup misses and floating-window failures do not show subtitle-view errors.
- Existing subtitle seeking, looping, scrolling, and selection behavior remains intact.
