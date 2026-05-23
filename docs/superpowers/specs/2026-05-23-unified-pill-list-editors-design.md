# Unified Pill List Editors Design

## Goal

Use one consistent pill-list interaction model for network endpoints, process blacklist entries, and subtitle priority entries.

The UI should feel like the current network endpoint editor:

- Saved items are read-only pills.
- Saved items are not editable in place.
- Saved items can be removed only through a small hover/focus close button.
- A trailing blank pill accepts new item text.
- Pressing Enter or blurring the blank pill adds the item.
- The blank pill stays compact, matching the shortened network endpoint draft width.

The project is not released. There is no compatibility, migration, legacy data handling, fallback path, or transition layer.

## Shared Pill List Component

Create a small renderer component for the shared behavior. The component owns only generic pill-list UI and events.

It displays:

- A label and optional hint.
- A wrapping list of saved item pills.
- A trailing draft pill with a borderless input.
- A small `UiIconButton` close control using the local `IconClose` lucide wrapper.
- Optional inline error text.

It emits:

- Add draft item.
- Remove saved item.
- Reorder saved item when drag sorting is enabled.
- Draft value updates when the parent wants controlled input.

It does not own:

- Network endpoint parsing.
- Endpoint URL formatting.
- Process blacklist normalization.
- Subtitle priority regex validation.
- Store updates.
- Persistence.

Those remain in the existing parent/store layers.

## Shared Interaction Rules

Saved pills:

- Render text from parent-provided display strings.
- Are read-only.
- Do not enter edit mode on click.
- Reveal a small close button on hover and focus-within.
- Use the same close-button geometry as the network endpoint pill: compact, centered on the pill border near the upper-right curve.

Draft pill:

- Appears after all saved pills, even when the list is empty.
- Uses the same compact width as the shortened network endpoint blank pill.
- Contains a borderless input.
- Adds the item on Enter or blur when the draft text is non-empty and valid.
- Clears after a successful add.
- Keeps the draft text when validation fails.

Deletion:

- Happens only through the close button.
- Dragging never deletes an item.

## Network Endpoints

Network endpoints keep their existing business behavior:

- Saved pills display canonical extension URLs.
- Loopback URLs omit the token.
- Non-loopback URLs include the shared token.
- The draft accepts `host:port` and `ws://host:port/?token=...`.
- Invalid or duplicate endpoint text shows an inline error and does not update settings.
- The last remaining endpoint cannot be removed.
- Listener errors remain visible under the pill list.

The shared pill component only replaces the duplicated pill rendering and draft input shell. Endpoint parsing and URL formatting stay in the network endpoint editor logic.

## Process Blacklist

The process blacklist replaces the current separate input, add button, and chip list with the shared pill-list UI.

Final behavior:

- Saved process names render as read-only pills.
- Each saved process can be removed with the hover/focus close button.
- A trailing blank pill accepts new process names.
- Enter or blur adds the trimmed process name.
- Empty input is ignored.
- Duplicate names follow the existing store behavior.
- There is no empty-state message for the blacklist list; the blank pill is the empty state.
- There is no drag sorting for process names.

## Subtitle Priority

Primary and secondary subtitle priority lists use the shared pill-list UI.

Final behavior:

- Saved priority patterns render as read-only pills.
- Each saved pattern can be removed with the hover/focus close button.
- A trailing blank pill accepts new regex text.
- Enter or blur adds the draft when the regex is valid.
- Invalid regex text shows the existing inline error and does not update settings.
- The existing hint link to regex documentation remains.
- Primary and secondary lists remain independent.

Drag sorting:

- Saved subtitle priority pills are draggable.
- Dragging within the same list reorders items.
- Dragging between primary and secondary lists is ignored.
- Dropping outside a list is ignored.
- Drag end without a valid drop is ignored.
- No drag action removes an item.

## Styling

The shared UI keeps the current network endpoint pill visual language:

- Rounded pill shape.
- Read-only saved item text.
- Borderless draft input.
- Compact draft pill width.
- Small close button using `UiIconButton` and `IconClose`.
- No box shadows, gradients, blur filters, or new decorative effects.

The component should reuse existing UI primitives and local icon wrappers instead of raw buttons or hand-written icon text.

## Testing Requirements

Renderer tests should cover:

- Network endpoint behavior still renders canonical URLs, validates duplicates, blocks deleting the final endpoint, and adds on blur.
- Process blacklist renders as pill UI, adds from the trailing draft pill, removes only through the close button, and no longer renders the separate add button flow.
- Subtitle priority renders as pill UI, adds from the trailing draft pill, validates regex input, removes through the close button, and keeps the regex documentation link.
- Subtitle priority drag sorting reorders within the same list.
- Subtitle priority drag end and invalid drops do not remove items.
- Shared pill browser layout keeps the compact draft width, borderless draft input, and close button geometry.
- UI library boundary tests continue to reject raw controls in settings UI.

## Non-Goals

- No compatibility with previous settings data shapes.
- No migration of existing settings.
- No legacy UI path.
- No in-place editing for saved pills.
- No drag deletion.
- No cross-list subtitle priority dragging.
- No new data model for process blacklist or subtitle priority storage.
