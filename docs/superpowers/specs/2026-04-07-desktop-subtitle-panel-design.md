# Desktop Subtitle Panel Final-State Design

## Goal

Redesign `desktop-app`'s subtitle panel into its final form only. Do not preserve the current cue-list UI shape, do not design migration layers, and do not add compatibility paths for old rendering logic or old data. The new panel should use `pretext` as the text layout engine rather than as a small helper.

## Current State Summary

The current subtitle panel is a lightweight cue list:

- The renderer builds `CombinedCue[]` from primary and secondary subtitle cues.
- The view renders one DOM item per cue with `v-for`.
- Each cue item permanently owns timestamp, play, loop, and A-B controls.
- Auto-scroll targets cue DOM nodes directly.
- Primary and secondary subtitles are visually stacked inside each cue item.

This is structurally a list UI, not a reading UI.

## Final-State Product Direction

The final subtitle panel is a continuous bilingual reading surface driven by `pretext`. `cue` remains the time and interaction anchor, but it is no longer the dominant UI unit.

In one sentence:

The desktop subtitle panel becomes a `pretext`-driven cue-anchored transcript reader, with cue-level actions attached as lightweight anchors instead of permanent list-row chrome.

## Chosen Direction

Use the previously approved direction:

- Continuous reading flow
- Cue anchor layer
- No item-list-dominant UI
- No fallback renderer that restores the old cue list

This replaces the current list model instead of refining it.

## Reference Technology Decision

`pretext` is the primary layout engine for the new panel.

Its relevant capabilities for this design:

- one-time text preparation, then cheap repeated layout on width changes
- paragraph and line layout without DOM measurement loops
- line-level output for custom rendering
- `inline-flow` support for mixed inline runs, atomic inline items, and caller-owned inline chrome

Its design limits also define this spec:

- do not treat it as a full CSS inline formatting engine
- do not wrap it in a generic compatibility abstraction
- do not preserve the current DOM-list architecture and only patch in layout math

## Architecture

The subtitle panel is split into three focused layers on one direct rendering path.

### 1. Transcript Model

Purpose:
Turn raw subtitle tracks into cue-anchored reading blocks.

Inputs:

- primary subtitle track
- secondary subtitle track
- playback-related metadata needed for activity mapping

Outputs:

- ordered reading blocks
- cue references for each block
- stable time ranges per block

Rules:

- preserve cue time boundaries as interaction anchors
- do not expose `CombinedCue[]` as the final rendering unit
- allow a block to contain primary text with missing secondary text
- pair primary and secondary subtitles by cue timing only
- do not attempt semantic alignment across downloaded subtitle tracks
- prefer preserving primary cue continuity when timing-based pairing is imperfect

Each reading block contains at least:

- `id`
- `start`
- `end`
- `primaryText`
- `secondaryText`
- `sourceCueRefs`

### 2. Pretext Layout Model

Purpose:
Compile reading blocks into prepared `pretext` inputs and project them into measurable, line-addressable layout results.

Responsibilities:

- prepare text once per block/style combination
- recompute layout on width changes without DOM measurement
- map every rendered line back to its owning block
- expose enough line metadata for activity, hover, and cue actions

Rules:

- main text layout is `pretext`-first
- timestamp and controls are not part of the primary reading flow
- `inline-flow` is used only where mixed inline fragments are actually needed
- no compatibility wrapper that emulates the old cue-item DOM contract
- the named font stack used for `pretext` measurement must exactly match the rendered subtitle font stack
- user-facing font selection is restricted to a curated named-font list; do not allow arbitrary font-family input or a separate measurement font

### 3. Transcript Viewport

Purpose:
Render the visible reading window and keep the active reading region stable during playback.

Responsibilities:

- determine active block from playback time
- determine visible context window around the active block
- position the focus band in the viewport
- render lightweight cue anchors for interaction

Rules:

- scrolling targets active reading blocks or the focus band, not cue DOM refs
- text selection pauses auto-follow
- resuming auto-follow should restore the focus band, not snap to a legacy list position

## UI Structure

The final panel has two visible zones.

### 1. Control Cap

This is a thinner version of the existing top control area.

It keeps:

- video title and source context
- subtitle track selection
- transcription controls
- playback controls
- panel-level status banner

It does not compete with the reading area for visual dominance.

### 2. Reading Surface

This is the core of the panel.

Characteristics:

- one continuous scrollable bilingual transcript surface
- a focus band centered around the active playback region
- active content appears strongest
- near context remains readable
- far context remains present but visually weaker

The reading surface is not a vertical list of repeated row shells.

## Reading Block Presentation

Each reading block is presented as transcript content, not as a card.

Presentation rules:

- primary subtitle is the dominant text layer
- secondary subtitle follows as a subordinate text layer within the same reading unit
- visual hierarchy is created through typography, color, opacity, and spacing
- visual hierarchy is not created through row borders, row backgrounds, or permanent toolbar rows

The current cue-item frame is intentionally removed.

## Cue Anchor Layer

Cue semantics remain, but only as a lightweight interaction layer.

Cue anchor behavior:

- a block can be clicked to seek to its start time
- active or hovered blocks reveal cue actions
- cue actions include play/seek, single-cue loop, and A-B range selection
- timestamps are not permanently rendered as a leading row header

Recommended anchor placement:

- left edge of the active block
- left edge of a hovered block

This keeps the reading surface clean while preserving the current subtitle tooling value.

## Data Flow

The final-state pipeline is:

1. raw subtitle tracks
2. timing-pairing pass
3. flow compilation
4. `pretext` layout pass
5. viewport projection
6. reading-surface render

### Raw Subtitle Tracks

Use raw selected subtitle tracks as the source of truth.

### Timing-Pairing Pass

Convert primary and secondary tracks into reading blocks.

Rules:

- pair for display by cue timing, not by semantic meaning
- keep primary cue continuity as the top priority
- allow secondary text to be absent
- do not merge cues into semantic paragraphs
- preserve source cue references for interactions

### Flow Compilation

Compile each reading block into prepared layout inputs.

Rules:

- primary text is a main text block
- secondary text is a following subordinate block
- timestamp and controls stay outside the main text layout stream
- use inline-flow only where mixed inline fragments are needed

### Pretext Layout Pass

For a given available width, compute:

- block heights
- line list per block
- line ownership
- geometry for focus-band positioning and interaction anchoring

### Viewport Projection

From playback time and current viewport dimensions, compute:

- active block
- focus-band range
- visible context window
- scroll target

The core state is therefore:

- active block identity
- projected visible transcript window

The core state is not:

- active cue index plus DOM refs

## Interaction Model

The reading flow owns the experience. Controls attach to it without interrupting it.

### Core Interactions

- click a reading block to seek to its start time
- reveal cue actions on the active block
- reveal cue actions on hover for non-active blocks
- allow single-cue loop from the cue anchor
- allow A-B looping by selecting a start anchor and then an end anchor

### A-B Loop Rule

The current two-step A/B interaction remains functionally available, but the controls are no longer permanently rendered on every unit.

Behavior:

- first selection sets A
- second selection sets B
- selected A and pending B targets are visibly marked inside the reading surface

### Timestamp Rule

Timestamps are no longer persistent row headers.

They may appear:

- on the active block
- on hover
- during text selection or focused interaction

When timestamps and cue controls appear, preserve the previous cue-tooling muscle memory:

- render them as a compact inline strip directly above the block text
- keep the order as timestamp, play, A/B, loop
- keep the visual treatment close to the previous subtitle control row rather than introducing new pill or rail chrome

### Selection and Auto-Follow

Selection behavior remains simple:

- selecting text pauses auto-follow
- manual scrolling pauses auto-follow
- clearing selection allows auto-follow to resume
- after manual scrolling stops, auto-follow resumes only after the configured restore delay
- resume returns the focus band to the stable reading zone

## Auto-Follow and Scrolling

Auto-follow changes from list-follow to reading-band stabilization.

Rules:

- follow the active reading block, not a cue DOM node
- place the focus band in a stable viewport zone
- avoid jitter when playback state briefly stalls
- keep scroll behavior subordinate to user text selection

The target behavior is a stable reading experience, not item-by-item snapping.

## Error Handling Scope

Do not add more error handling than the current project already has.

The final state keeps the same overall level of protection:

- initialization error surface
- panel status states
- subtitle parsing cleanup
- local guard clauses for missing interaction targets

Do not add:

- fallback rendering chains
- dual renderer compatibility logic
- layout recovery layers that restore the old list UI
- generic try-heavy protection wrappers around normal render flow

### Final-State Error Handling Rules

Keep only equivalent categories already present today:

- initialization failure can surface as panel state
- missing video or missing subtitles can surface as panel state
- malformed subtitle content is normalized or skipped during parsing/model compilation
- missing interaction targets return early without escalating UI complexity

`pretext` is the primary engine. The design does not include a fallback path that rebuilds the old cue list if layout is unavailable.

## Testing Scope

Do not expand testing scope beyond the current project's effective level. Keep tests proportional to the redesigned panel.

Recommended test focus:

- reading block generation from subtitle tracks
- layout projection stability for a given width
- activity mapping from playback time to active block
- cue anchor interactions: seek, loop, A-B
- panel state rendering for existing high-level states

Do not add:

- old/new renderer parity tests
- compatibility tests for removed list APIs
- large snapshot suites for every visual variation
- dedicated fallback-path tests

## Explicit Non-Goals

The redesign does not include:

- migration layers for the current list-based subtitle panel
- compatibility adapters for old cue-row rendering contracts
- old data migration work
- fallback rendering to the current list UI
- generic abstraction layers around `pretext`
- speculative support for not-yet-needed rich text systems

## Implementation Constraints For The Future Plan

The later implementation plan must preserve these design decisions:

- one direct rendering architecture
- `pretext` as the layout core
- no old-list compatibility bridge
- no extra fallback renderer
- no increase in error-handling complexity
- no increase in test surface beyond the approved scope

## Design Outcome

The approved final form is:

- a thin control cap
- a `pretext`-driven cue-anchored bilingual reading surface
- cue-level actions exposed as lightweight anchors
- stable focus-band auto-follow
- no cue-row-dominant list UI

This is the final-state direction for the desktop subtitle panel.
