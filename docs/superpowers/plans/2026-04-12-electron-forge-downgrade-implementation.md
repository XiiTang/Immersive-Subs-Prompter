# Electron Forge 7.11.1 Downgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Downgrade all `@electron-forge/*` dependencies in `desktop-app` from `8.0.0-alpha.7` to `7.11.1` and verify the desktop app still builds, tests, packages, makes distributables, and starts locally.

**Architecture:** Keep the downgrade scoped to the Electron desktop package. Restore the Forge toolchain to the last known stable version already used by this repository, then rebuild the npm lockfile from `desktop-app/package.json` and validate with fresh end-to-end local commands.

**Tech Stack:** npm, Electron Forge, Electron, TypeScript, Vite, Vitest

---

### Task 1: Prepare the downgrade scope

**Files:**
- Modify: `desktop-app/package.json`
- Modify: `desktop-app/package-lock.json`
- Verify: `desktop-app/forge.config.mjs`

- [ ] **Step 1: Confirm the current Forge dependency surface**

```bash
rg -n '"@electron-forge/' desktop-app/package.json desktop-app/package-lock.json desktop-app/forge.config.mjs
```

Expected: `package.json` and `package-lock.json` show `8.0.0-alpha.7`, and `forge.config.mjs` imports Forge makers/plugins without version-specific code changes.

- [ ] **Step 2: Change all direct Forge dependencies to `7.11.1`**

```json
"@electron-forge/cli": "7.11.1",
"@electron-forge/maker-deb": "7.11.1",
"@electron-forge/maker-dmg": "7.11.1",
"@electron-forge/maker-rpm": "7.11.1",
"@electron-forge/maker-squirrel": "7.11.1",
"@electron-forge/maker-zip": "7.11.1",
"@electron-forge/plugin-auto-unpack-natives": "7.11.1",
"@electron-forge/plugin-fuses": "7.11.1"
```

- [ ] **Step 3: Rebuild the lockfile from the downgraded manifest**

```bash
cd desktop-app && npm install
```

Expected: npm rewrites `package-lock.json` so direct and transitive Forge packages resolve to the `7.11.1` family.

### Task 2: Verify local build and tests

**Files:**
- Verify: `desktop-app/package.json`
- Verify: `desktop-app/package-lock.json`

- [ ] **Step 1: Run the desktop build**

```bash
cd desktop-app && npm run build
```

Expected: exit code `0` and compiled main/preload plus Vite renderer output under `dist/`.

- [ ] **Step 2: Run renderer tests**

```bash
cd desktop-app && npm run test:renderer
```

Expected: exit code `0` with both browser and jsdom Vitest projects passing.

### Task 3: Verify packaging toolchain

**Files:**
- Verify: `desktop-app/forge.config.mjs`
- Verify: `desktop-app/out/`

- [ ] **Step 1: Run Forge package**

```bash
cd desktop-app && npm run package
```

Expected: exit code `0` and packaged application output under `out/`.

- [ ] **Step 2: Run Forge make on the current host**

```bash
cd desktop-app && npm run make
```

Expected: exit code `0` and current-platform artifacts generated under `out/make/`.

### Task 4: Run startup smoke test

**Files:**
- Verify: `desktop-app/dist/`
- Verify: `desktop-app/out/`

- [ ] **Step 1: Start the app through Forge**

```bash
cd desktop-app && npm run start
```

Expected: Electron launches without an immediate main-process crash, the renderer loads, and no startup error is emitted before the app is closed.

- [ ] **Step 2: Record failures precisely if any verification step breaks**

```text
Capture the exact failing command, exit code, and first relevant error block before making any follow-up fix.
```

- [ ] **Step 3: Commit only after all requested verification is complete**

```bash
git add desktop-app/package.json desktop-app/package-lock.json docs/superpowers/plans/2026-04-12-electron-forge-downgrade-implementation.md
git commit -m "chore: downgrade electron forge to 7.11.1"
```
