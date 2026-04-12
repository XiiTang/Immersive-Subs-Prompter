# Settings Panel Redesign Implementation Plan

> **Status:** ✅ COMPLETED - All tasks implemented and verified. All 103 tests pass.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the desktop settings window into a document-style layout with a stable left navigation, a continuous right-hand scroll surface, and a lighter modern visual system without changing settings behavior.

**Architecture:** Keep the current Electron window and Pinia/IPC data flow intact, but replace the renderer shell from "single active page" to "left directory + right document". Centralize the visual system in shared renderer CSS, keep complex sections (`Profiles`, `Rules`, `Media Server`) structurally richer than simple fields, and verify the redesign with jsdom and browser regression tests.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Playwright browser snapshots, Electron renderer CSS

---

## File Structure

### Existing files to modify

- `desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
  - Replace single-section conditional rendering with one scrollable document containing all top-level sections.
- `desktop-app/src/renderer/components/settings/SettingsNav.vue`
  - Convert nav from "active page switcher" to "scroll-to-section directory" and expose section metadata needed for orientation.
- `desktop-app/src/renderer/components/settings/settingsSections.ts`
  - Expand section metadata so nav and shell share ids, labels, descriptions, and anchor/test ids.
- `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
  - Update jsdom expectations from "conditional page swap" to "all sections render and nav tracks current section".
- `desktop-app/src/renderer/style.css`
  - Introduce the new settings-shell visual system: surface colors, spacing, typography, controlled content width, stable scrollbar gutter, section rhythm, and lighter controls.
- `desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
  - Remove local card-heavy layout and migrate to document-style section groups.
- `desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
  - Align headings, spacing, and split-pane surface styling to the shared shell language.
- `desktop-app/src/renderer/components/settings/SettingsRules.vue`
  - Keep dual-pane behavior, but restyle it to the lighter system and fit it into the long-page chapter rhythm.
- `desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
  - Re-group fields into document sections and normalize spacing/controls against shared styles.
- `desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
  - Align entity-management UI with the shared document shell and lighter split-pane treatment.
- `desktop-app/src/renderer/components/settings/SettingsCache.vue`
  - Move cache/danger actions into a low-noise end-of-document section with clearer separation.
- `desktop-app/src/renderer/SettingsApp.vue`
  - Add the root class hooks needed for the new settings shell if required.

### Existing tests to modify

- `desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts`
  - Refresh screenshot expectations if the split-pane visuals change materially.
- `desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
  - Refresh screenshot expectations if the profile editor visuals change materially.

### Files likely to create

- `desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
  - Browser-level regression for the redesigned shell layout, scroll gutter, and directory styling.

## Task 1: Lock the new shell behavior with failing tests

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Create: `desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Modify: `desktop-app/src/renderer/components/settings/settingsSections.ts`

- [x] **Step 1: Write the failing jsdom test for document-style rendering**

- [x] **Step 2: Run the jsdom test and verify it fails**

Run:

```bash
npm run test:renderer:jsdom -- SettingsWindowShell
```

- [x] **Step 3: Write the failing browser regression test for the new shell**

- [x] **Step 4: Run the browser test and verify it fails**

Run:

```bash
npm run test:renderer:browser -- SettingsWindowShell.browser
```

- [x] **Step 5: Commit the failing-test baseline**

## Task 2: Refactor the settings shell into a directory + document layout

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/settingsSections.ts`
- Modify: `desktop-app/src/renderer/components/settings/SettingsNav.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`

- [x] **Step 1: Expand the section metadata so shell and nav can share anchors**

- [x] **Step 2: Update the nav component so it emits scroll targets, not page switches**

- [x] **Step 3: Replace conditional page rendering with one scrollable document shell**

- [x] **Step 4: Run the jsdom tests and make sure the shell tests pass**

Run:

```bash
npm run test:renderer:jsdom -- SettingsWindowShell
```

- [x] **Step 5: Commit the shell refactor**

## Task 3: Introduce the shared visual system and scroll-safe shell styles

**Files:**
- Modify: `desktop-app/src/renderer/style.css`
- Modify: `desktop-app/src/renderer/SettingsApp.vue`
- Test: `desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`

- [x] **Step 1: Write the failing style assertions in the browser test**

- [x] **Step 2: Run the browser test and verify it fails**

- [x] **Step 3: Implement the shared settings-shell visual system in `style.css`**

- [x] **Step 4: Add the root class hook in `SettingsApp.vue` if the layout needs a dedicated mount class**

- [x] **Step 5: Run browser and renderer type checks**

Run:

```bash
npm run typecheck:renderer
npm run test:renderer:browser -- SettingsWindowShell.browser
```

- [x] **Step 6: Commit the visual-system shell**

## Task 4: Convert simple settings sections to document-style content blocks

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Modify: `desktop-app/src/renderer/style.css`

- [x] **Step 1: Write a failing shell/browser assertion that the heavy cards are gone from `General`**

- [x] **Step 2: Run the focused test and verify it fails**

- [x] **Step 3: Refactor `SettingsGlobal.vue` into section groups backed by shared styles**

- [x] **Step 4: Add the reusable group primitives to `style.css` and apply them to `Transcription`/`Cache`**

- [x] **Step 5: Run jsdom and browser tests for the simple sections**

Run:

```bash
npm run test:renderer:jsdom -- SettingsWindowShell
npm run test:renderer:browser -- SettingsWindowShell.browser
```

- [x] **Step 6: Commit the simple-section refactor**

## Task 5: Align complex sections with the new shell without changing their behavior

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsRules.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `desktop-app/src/renderer/style.css`
- Modify: `desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
- Modify: `desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts`

- [x] **Step 1: Write the failing screenshot expectation for the lighter split panes**

- [x] **Step 2: Run the browser tests and verify they fail**

- [x] **Step 3: Soften the split-pane CSS and align headings with the chapter system**

- [x] **Step 4: Add chapter headers around `Profiles`, `Rules`, and `Media Server` while preserving their internal editors**

- [x] **Step 5: Run the browser regression tests and renderer suite**

Run:

```bash
npm run test:renderer:browser -- SettingsRules SettingsProfiles SettingsWindowShell.browser
npm run test:renderer:jsdom -- SettingsWindowShell
```

- [x] **Step 6: Commit the complex-section alignment**

## Task 6: Final verification and cleanup

**Files:**
- Modify: `desktop-app/src/renderer/style.css`
- Test: `desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Test: `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`

- [x] **Step 1: Add the final regression assertions for orientation and scroll safety**

- [x] **Step 2: Run the full renderer verification suite**

Run:

```bash
npm run typecheck:renderer
npm run test:renderer
```

Result: **PASS** - 103 tests pass (jsdom: 63, browser: 40)

- [x] **Step 3: Do a final spec-to-code checklist before closing**

Use this checklist:

```text
✓ left nav remains stable while right content scrolls
✓ right side renders all six top-level chapters in one document
✓ nav click scrolls to chapter instead of swapping pages
✓ active chapter is reflected in nav state
✓ right content uses a controlled reading width
✓ scrollbar gutter is stable and content has right-side breathing room
✓ general/transcription/cache use document groups instead of heavy card stacks
✓ profiles/rules/media-server keep richer structures but share the same visual language
```

- [x] **Step 4: Commit the verification pass**

## Self-Review

Spec coverage check:

- Information architecture is covered by Task 2.
- Visual language and surface strategy are covered by Tasks 3, 4, and 5.
- Long-page reading flow and chapter rhythm are covered by Tasks 2 and 4.
- Scrollbar space, orientation, and sticky-ready shell behavior are covered by Tasks 2, 3, and 6.
- Complex-section handling for `Profiles`, `Rules`, and `Media Server` is covered by Task 5.
- Validation and regression coverage are covered by Tasks 1, 3, 5, and 6.

Placeholder scan:

- No `TODO`, `TBD`, or deferred references remain.
- Every task includes file paths, code snippets, and explicit commands.

Type consistency check:

- Section ids are consistently `general`, `profiles`, `rules`, `transcription`, `media-server`, and `cache`.
- Shared anchor naming stays `settings-section-<id>` across metadata, shell ids, tests, and nav targets.
- Shell state uses `aria-current="location"` consistently for the document-directory pattern.