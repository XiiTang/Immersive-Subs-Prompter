# Pretext Transcript Virtualization Design

## Goal

Extend the current `pretext`-based transcript surface so it fully uses deterministic layout projection to support block-level virtualized rendering and stable viewport reprojection.

This design is specifically intended to:

- reduce DOM cost by rendering only visible transcript blocks plus overscan
- make `resize` and timestamp `seek` follow the same anchor-based reprojection model
- preserve the current block/cue interaction model
- reserve data-model space for future line-level highlighting and interaction

## Current State

The current transcript surface already moved away from the old cue-row list:

- transcript content is compiled into `TranscriptBlock[]`
- `pretext` computes deterministic line wrapping and block heights
- the viewport projection finds the active block and computes a target `scrollTop`
- rendering still mounts every block in the DOM and positions them absolutely

This means layout math is already `pretext`-first, but rendering is still full-DOM rather than windowed.

## Problem

The current implementation leaves part of `pretext`'s value unused:

- deterministic layout exists, but it is not used to cull off-screen content
- viewport behavior is still centered around direct scroll positioning rather than a reusable anchor model
- `resize` and `seek` do not yet share one explicit reprojection contract
- future line-aware capabilities would currently need to be bolted on top of a block-only projection path

## Product Direction

The transcript surface should treat `pretext` layout as the geometry source of truth and add a dedicated projection layer above it.

The chosen direction is:

- keep `block` as the smallest DOM rendering unit
- keep full deterministic layout as a pure computation step
- add unified anchor projection for `playback`, `seek`, `resize`, and follow resume
- add block-window virtualization driven by layout geometry

## Non-Goals

This design does not include:

- switching the main renderer to per-line DOM rendering
- replacing cue/block interactions with a line-oriented interaction model
- incremental or partial `pretext` layout recomputation
- a generic virtualization abstraction for unrelated lists
- restoring the old cue-list renderer or compatibility wrappers around it

## Chosen Architecture

The transcript surface is split into four stages on one direct render path.

### 1. Full Layout Stage

Purpose:
Produce deterministic transcript geometry for the whole transcript.

Input:

- `TranscriptBlock[]`
- transcript width
- typography settings
- spacing settings

Output:

- `TranscriptLayoutResult`
- full block geometry
- full line geometry
- total content height

Rules:

- layout remains full-range, not windowed
- `pretext` remains the only source of wrapping and line geometry
- output must remain deterministic for the same text, font, width, and spacing inputs

### 2. Anchor Projection Stage

Purpose:
Translate user or playback events into a stable reading anchor and a target viewport position.

Input:

- layout result
- viewport height
- follow ratio
- current playback time
- explicit projection reason when available

Output:

- projected active block
- focus-band offset
- target `scrollTop`
- projection reason metadata

Rules:

- all viewport recentering flows through anchors
- `seek` and `resize` use the same reprojection formula
- anchors are semantic layout references, not DOM node references
- the default anchor target is a block, with room to extend to a block-relative sub-position later

### 3. Window Projection Stage

Purpose:
Convert viewport position into a render window.

Input:

- layout result
- current viewport `scrollTop`
- viewport height
- overscan distance

Output:

- start and end block indexes to render
- rendered block slice
- top and bottom unrendered space metadata

Rules:

- windowing happens at block granularity
- overscan must be large enough to avoid visible mount churn during smooth follow
- window projection must not affect interaction semantics

### 4. View Stage

Purpose:
Render the transcript surface from projection outputs rather than deriving behavior locally.

Input:

- full content height
- render-window blocks
- projected active block identity
- interaction state

Output:

- windowed transcript DOM

Rules:

- `TranscriptSurface.vue` becomes a projection consumer, not the owner of projection logic
- block components remain cue-aware and action-aware
- component lifecycle must not be the source of truth for loop, A-B, hover, or active state

## Data Model Changes

### Layout Output

The layout output is block-first with a parallel line array for per-block line slicing.

Required block-level metadata:

- `blockId`
- `start`
- `end`
- `top`
- `height`
- `lineStart`
- `lineCount`

Required line-level metadata:

- `key`
- `blockId`
- `kind`
- `text`
- `top`
- `height`
- `relativeTop` (block-relative top offset)

The layout result also carries the full `lines` array; consumers slice it by `lineStart` and `lineCount` from each block.

### Anchor Model

Introduce an explicit viewport anchor type.

Minimum fields:

- `blockId`
- `reason`
- `anchorBias`

Definitions:

- `blockId` identifies the semantic target
- `reason` explains why the projection was requested, such as `playback-follow`, `seek-recenter`, `resize-reproject`, or `resume-follow`
- `anchorBias` represents which vertical point inside the block should align to the focus band

For this design, `anchorBias` defaults to the block's visual midpoint.

## Unified Viewport Reprojection Rules

All viewport corrections follow the same chain:

`event -> anchor -> layout -> targetScrollTop`

### Playback Follow

- derive the active block from playback time
- create or refresh a `playback-follow` anchor
- project that anchor into a target `scrollTop`
- only perform the scroll when the projected target changes materially

### Seek

- when the user seeks to a timestamp, find the target active block immediately
- create a `seek-recenter` anchor for that block
- reproject and move the viewport to the focus band
- this is allowed to override paused auto-follow or selection-paused state because it is an explicit user action

### Resize

- when viewport width or height changes, rerun full layout first
- do not preserve old `scrollTop` as authoritative state
- reuse the most recent valid anchor and reproject it against the new layout
- if no explicit anchor exists, fall back to the current active block

### Resume Follow

- when follow resumes after manual pause or selection pause, reproject the most recent valid anchor
- do not use a separate legacy "scroll to active block center" path

## Virtualization Rules

### Render Unit

The smallest mounted DOM unit remains the transcript block.

Why:

- current interactions are block/cue based
- this keeps the migration low-risk
- it preserves future flexibility without introducing line-level render complexity now

### Window Computation

The window projector should:

- compute the visible block range from `scrollTop` and viewport height
- expand the range by configurable overscan on both sides
- emit a stable block slice even during minor scroll changes

Expected behavior:

- blocks fully outside the overscan range are not mounted
- the content container still reports full transcript height
- rendered blocks may continue to use absolute `top` positioning for this phase

### Overscan

Overscan should be pixel-based rather than block-count-based.

Why:

- transcript block heights vary significantly
- pixel overscan is more stable under wrapped text and mixed primary/secondary content

## Interaction and State Rules

### Selection and Manual Scrolling

- selection pause still suppresses automatic playback-follow scrolling
- explicit user `seek` is allowed to reclaim the viewport focus band
- explicit user `seek` should also clear or reconcile pause state so the viewport model is not internally contradictory

### Active, Hover, Loop, and A-B State

- these states must be keyed by block identity or cue identity
- they must not depend on whether a block component is currently mounted
- unmounting and remounting a block due to virtualization must preserve visual and behavioral continuity
- single-cue loop may lock playback-follow to that cue's block, but A-B loop must use its own stable range anchor; in A-B mode the viewport anchor may stay fixed while the active block highlight continues to follow playback within the selected range

## Testing Strategy

### Pure Projection Tests

Add focused tests for:

- anchor reprojection under `playback-follow`
- anchor reprojection under `seek-recenter`
- anchor reprojection under `resize-reproject`
- fallback behavior when no explicit anchor is available
- window range computation for different viewport sizes, `scrollTop` values, and overscan values

### Component Tests

Add or update component tests for:

- initial mount renders only the projected block window
- seek recenters the target block even if follow was previously paused
- resize preserves the reading anchor rather than the stale pre-resize `scrollTop`
- blocks can leave and re-enter the window without losing active, loop, or A-B semantics

### Regression Focus

The highest-risk regressions are:

- smooth follow becoming visually jittery near window boundaries
- focus-band drift after repeated resize events
- inconsistent behavior between `seek` and follow resume
- state loss when block components are remounted

## Implementation Constraints

- do not reintroduce DOM-measurement-driven layout
- do not change the transcript renderer to line-level DOM output in this scope
- do not hide projection logic inside ad hoc component watchers
- keep layout, anchor projection, and window projection as separately testable units

## Success Criteria

This design is successful when:

- transcript DOM size scales with viewport window, not transcript length
- `seek` and `resize` visibly obey one stable focus-band rule
- current block/cue actions still behave identically from the user's perspective
- future line-aware features can be added through metadata and projection evolution rather than renderer replacement
