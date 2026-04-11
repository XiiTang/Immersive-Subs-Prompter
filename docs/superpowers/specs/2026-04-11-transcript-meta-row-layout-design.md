# Transcript Meta Row Layout Design

## Goal

Unify each transcript block into one stable layout unit by moving timestamp and cue actions into a fixed-height meta row inside the block geometry.

The design must:

- remove block-external floating cue actions
- eliminate layout whitespace caused by separating subtitle text from interaction chrome
- preserve stable block geometry for virtualization, follow, seek, and resize reprojection
- replace the old layout model directly, with no compatibility or migration layer

## Non-Goals

This design does not include:

- preserving the old floating rail positioning model
- feature flags or runtime switches between old and new layouts
- migration helpers for old geometry, old tests, or old component contracts
- line-level DOM rendering
- expanding `pretext` to lay out UI controls

## Product Decision

The transcript block becomes a two-part container:

- fixed-height `meta row`
- `pretext`-laid out text body

The `meta row` is always part of the block's real geometry. Interaction visibility changes presentation only. It must never change block height.

## Layout Model

### Geometry

Each block height is:

`metaRowHeight + metaRowGap + textHeight`

Where:

- `metaRowHeight` is a fixed layout constant
- `metaRowGap` is the fixed spacing between the meta row and text body
- `textHeight` is fully computed by `pretext`

### Text Layout Boundary

`pretext` remains responsible only for:

- text wrapping
- line heights
- text body height
- line relative positions inside the text body

The outer transcript layout layer is responsible for:

- adding fixed chrome height to each block
- offsetting text lines below the meta row
- publishing final block geometry for viewport and virtualization consumers

### Required Layout Output

Each layout block must include:

- `blockId`
- `start`
- `end`
- `top`
- `height`
- `lineStart`
- `lineCount`

Each layout line must include:

- `key`
- `blockId`
- `kind`
- `text`
- `top`
- `height`
- `relativeTop`

`relativeTop` for every text line must include the fixed offset introduced by `metaRowHeight + metaRowGap`.

## View Structure

Each rendered transcript block uses this visual structure:

1. fixed `meta row`
2. text body

The `meta row` contains:

- timestamp
- play action
- loop action
- A/B action

`CueAnchorRail` is retained only as a content component for the block-internal meta row. It is no longer a floating rail abstraction.

## State Model

The `meta row` is always rendered. State changes affect visibility and emphasis, not geometry.

Supported visual states:

- `quiet`
- `hover`
- `active`
- `selection`
- `looping`
- `ab-pending`
- `focus-within`

Rules:

- timestamp remains weakly visible in `quiet`
- action buttons become prominent in non-quiet states
- strong states override weak states visually
- no state may add or remove layout height
- no state may move the row outside the block

Allowed transition properties:

- `opacity`
- `color`
- `background`
- `border-color`
- small `transform`
- `pointer-events`
- `visibility`

Forbidden transition strategies:

- conditional mount/unmount of the entire meta row
- `display: none` for layout-bearing structure
- height animation
- margin or padding expansion
- block-external slide-in positioning

## Interaction Rules

The block remains the playback click target.

The meta row remains independently interactive.

Rules:

- block click triggers cue playback
- meta row button clicks stop propagation
- active blocks expose actions without hover
- keyboard focus inside a block promotes the meta row into a visible interactive state
- non-active quiet blocks may reduce action prominence, but must not create hidden-focus inconsistencies

## Projection and Virtualization

Viewport projection and virtualization continue to operate at block granularity.

Rules:

- anchor projection targets the block, not the meta row internals
- follow, seek, resize, and resume-follow all use the same stable block geometry
- hover and action visibility state must not participate in layout inputs
- virtualization window computation uses final block `top` and `height`
- rendered content height must reflect the full block geometry including the meta row

No projection logic may special-case the old floating rail model.

## Component Responsibilities

### `pretextLayout.ts`

Must:

- accept fixed meta row sizing inputs
- compute final block heights including chrome
- shift text line offsets below the meta row

Must not:

- compute control layout
- branch on hover, active, or selection visibility

### `TranscriptBlock.vue`

Must:

- render a fixed block-internal meta row
- render text body below it
- consume layout output rather than deriving positioning locally

Must not:

- position cue actions outside block geometry
- preserve historical floating rail styles or contracts

### `CueAnchorRail.vue`

Must:

- render timestamp and cue actions within the meta row

Must not:

- own floating positioning semantics
- act as a detached overlay abstraction

## Code Removal Requirements

Implementation must delete, not preserve:

- block-external cue action positioning
- `bottom: 100%` style logic
- z-index or offset hacks whose only purpose is supporting the floating rail model
- conditional code paths for old vs new layout semantics
- compatibility adapters between old cue-action geometry and new block geometry
- tests that assert the old floating behavior

The codebase should converge on one layout model immediately. There is no production compatibility requirement.

## Testing Requirements

Update or add tests to verify:

- block height includes fixed meta row geometry
- text line `relativeTop` includes the meta row offset
- hover and active state changes do not alter block geometry
- projection outputs remain stable across interaction-state changes
- block click and button click behaviors remain separated
- virtualization uses final block geometry without special handling

Do not preserve legacy tests whose only purpose is validating the removed floating rail behavior.

## Implementation Constraints

- no feature flags
- no dual-layout support
- no migration layer
- no dead compatibility code
- no fallback to the previous floating rail positioning

The implementation should replace the old model directly and cleanly.
