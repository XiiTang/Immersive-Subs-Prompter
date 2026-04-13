# Root Workspace And Shared Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the repository into a root `pnpm workspace` with `apps/desktop-app`, `apps/extension`, and `packages/contracts`, and make the contracts package the only source of cross-app protocol types.

**Architecture:** The repository root becomes the only package-management and workflow entry point. The desktop app and extension remain separate runnable applications under `apps/`, while `packages/contracts` exposes a small, stable TypeScript API for protocol DTOs and directional message unions. Existing app-internal state stays inside each app; only transport-facing types move into the shared package.

**Tech Stack:** `pnpm` workspaces, TypeScript, Electron Forge, Vue 3.5, Vite, Vitest, esbuild

---

## File Structure

### Files To Create

- `package.json`
  - Root workspace manifest with repository-level `build`, `test`, and `typecheck` scripts.
- `pnpm-workspace.yaml`
  - Workspace package globs for `apps/*` and `packages/*`.
- `tsconfig.base.json`
  - Shared TypeScript baseline used by all workspace packages.
- `packages/contracts/package.json`
  - Shared protocol package manifest named `@immersive-subs/contracts`.
- `packages/contracts/tsconfig.json`
  - Contracts package TypeScript build config.
- `packages/contracts/src/core/loop.ts`
  - Shared loop DTOs and related unions.
- `packages/contracts/src/core/playback.ts`
  - Shared playback snapshot DTOs.
- `packages/contracts/src/core/video.ts`
  - Shared video-site and video-state DTOs.
- `packages/contracts/src/core/transport.ts`
  - Shared connection and command payload DTOs used by message envelopes.
- `packages/contracts/src/messages/from-extension.ts`
  - Extension-to-desktop message definitions.
- `packages/contracts/src/messages/to-extension.ts`
  - Desktop-to-extension command definitions.
- `packages/contracts/src/index.ts`
  - Stable public export surface for the contracts package.
- `packages/contracts/src/contracts.test.ts`
  - Protocol-level tests for exports and representative message shapes.
- `apps/desktop-app/src/renderer/monorepoWorkspace.test.ts`
  - Repository-structure test that asserts final workspace layout and root config.

### Files To Move

- `desktop-app/` -> `apps/desktop-app/`
  - Desktop Electron app becomes an `apps/*` workspace member.
- `extension/` -> `apps/extension/`
  - Browser extension becomes an `apps/*` workspace member.

### Files To Modify

- `apps/desktop-app/package.json`
  - Rename package, switch workspace dependency consumption, and remove standalone install assumptions.
- `apps/desktop-app/tsconfig.json`
  - Extend root base config and preserve desktop main-process settings.
- `apps/desktop-app/tsconfig.preload.json`
  - Extend root base config.
- `apps/desktop-app/tsconfig.renderer.json`
  - Extend root base config and preserve renderer-specific options.
- `apps/desktop-app/vitest.config.ts`
  - Keep desktop test behavior working from the moved path.
- `apps/desktop-app/src/renderer/testingStackUpgrade.test.ts`
  - Update repository-path assertions to the final `apps/*` and root-workspace layout.
- `apps/desktop-app/src/main/types.ts`
  - Remove duplicated cross-app protocol definitions and import from `@immersive-subs/contracts`.
- `apps/desktop-app/src/main/connectionManager.ts`
  - Consume directional message unions from contracts.
- `apps/desktop-app/src/main/stateManager.ts`
  - Consume shared DTOs where transport state enters desktop logic.
- `apps/desktop-app/src/preload.cts`
  - Keep desktop preload typings aligned if any protocol types are referenced.
- `apps/extension/package.json`
  - Rename package and add workspace dependency on `@immersive-subs/contracts`.
- `apps/extension/tsconfig.json`
  - Extend root base config and preserve extension-specific module settings.
- `apps/extension/esbuild.config.ts`
  - Keep extension build working from the moved path and package imports.
- `apps/extension/vitest.config.ts`
  - Keep extension tests resolving from the new directory.
- `apps/extension/src/shared/types.ts`
  - Remove duplicated transport types and keep only extension-private types.
- `apps/extension/src/background.ts`
  - Import and use shared protocol message types.
- `apps/extension/src/background/desktop/DesktopMessageHandler.ts`
  - Consume desktop command types from contracts.
- `apps/extension/src/background/messaging/ContentMessageRouter.ts`
  - Consume extension-to-desktop message types from contracts.
- `apps/extension/src/connection/MessageSender.ts`
  - Emit typed transport messages from contracts.
- `apps/extension/src/content/index.ts`
  - Build outgoing messages against shared contracts.
- `README.md`
  - Update quick start, install, and command examples to use root `pnpm` workflow and moved paths.
- `.gitignore`
  - Ignore `pnpm` workspace artifacts if needed and remove assumptions tied to root-level app directories.

### Files To Delete

- `desktop-app/package-lock.json`
  - Standalone npm lockfile must not exist in the final workspace.
- `extension/package-lock.json`
  - Standalone npm lockfile must not exist in the final workspace.

---

### Task 1: Bootstrap The Root Workspace And Repository Layout

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `apps/desktop-app/src/renderer/monorepoWorkspace.test.ts`
- Modify: `README.md`
- Move: `desktop-app/` -> `apps/desktop-app/`
- Move: `extension/` -> `apps/extension/`
- Delete: `desktop-app/package-lock.json`
- Delete: `extension/package-lock.json`
- Test: `apps/desktop-app/src/renderer/monorepoWorkspace.test.ts`

- [ ] **Step 1: Write the failing repository-structure test**

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rendererRoot = path.resolve(import.meta.dirname);
const desktopAppRoot = path.resolve(rendererRoot, "..", "..");
const repoRoot = path.resolve(desktopAppRoot, "..", "..", "..");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readText(filePath: string) {
  return readFileSync(filePath, "utf8");
}

describe("root workspace layout", () => {
  it("uses pnpm as the only workspace package manager", () => {
    const rootPackage = readJson<{ packageManager?: string; scripts?: Record<string, string> }>(
      path.join(repoRoot, "package.json")
    );
    const workspaceYaml = readText(path.join(repoRoot, "pnpm-workspace.yaml"));

    expect(rootPackage.packageManager).toBe("pnpm@10");
    expect(rootPackage.scripts?.build).toBe("pnpm -r build");
    expect(rootPackage.scripts?.test).toBe("pnpm -r test");
    expect(rootPackage.scripts?.typecheck).toBe("pnpm -r typecheck");
    expect(workspaceYaml).toContain("apps/*");
    expect(workspaceYaml).toContain("packages/*");
  });

  it("uses the final apps and packages directory layout", () => {
    expect(existsSync(path.join(repoRoot, "apps", "desktop-app", "package.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "apps", "extension", "package.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "packages", "contracts"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "desktop-app"))).toBe(false);
    expect(existsSync(path.join(repoRoot, "extension"))).toBe(false);
  });

  it("documents root pnpm workflows in the README", () => {
    const readme = readText(path.join(repoRoot, "README.md"));

    expect(readme).toContain("pnpm install");
    expect(readme).toContain("pnpm build");
    expect(readme).toContain("pnpm --filter @immersive-subs/desktop-app");
    expect(readme).toContain("pnpm --filter @immersive-subs/extension");
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails before the workspace exists**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter/desktop-app
npm run test:renderer -- src/renderer/monorepoWorkspace.test.ts
```

Expected: FAIL because the repository still has `desktop-app/` and `extension/` at the root, there is no root `package.json` for the workspace, and there is no `pnpm-workspace.yaml`.

- [ ] **Step 3: Create the root workspace files, move both apps under `apps/`, remove npm lockfiles, and update the README**

```json
{
  "name": "immersive-subs-prompter",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "build:desktop": "pnpm --filter @immersive-subs/desktop-app build",
    "build:extension": "pnpm --filter @immersive-subs/extension build",
    "test:desktop": "pnpm --filter @immersive-subs/desktop-app test:renderer",
    "test:extension": "pnpm --filter @immersive-subs/extension test"
  }
}
```

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "allowJs": false,
    "checkJs": false
  }
}
```

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
mkdir -p apps packages
mv desktop-app apps/desktop-app
mv extension apps/extension
rm -f apps/desktop-app/package-lock.json apps/extension/package-lock.json
pnpm install
```

- [ ] **Step 4: Run the repository-structure test and verify it passes from the moved desktop app**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/monorepoWorkspace.test.ts
```

Expected: PASS with the new workspace root, moved app directories, and updated README references.

- [ ] **Step 5: Commit the workspace bootstrap**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add package.json pnpm-workspace.yaml tsconfig.base.json README.md apps packages pnpm-lock.yaml
git commit -m "refactor: bootstrap pnpm workspace layout"
```

### Task 2: Create The Shared Contracts Package

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/core/loop.ts`
- Create: `packages/contracts/src/core/playback.ts`
- Create: `packages/contracts/src/core/video.ts`
- Create: `packages/contracts/src/core/transport.ts`
- Create: `packages/contracts/src/messages/from-extension.ts`
- Create: `packages/contracts/src/messages/to-extension.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/contracts.test.ts`
- Test: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write the failing contracts-package test**

```ts
import { describe, expectTypeOf, it } from "vitest";
import type {
  FromExtensionMessage,
  ToExtensionMessage,
  VideoStateSnapshot,
  LoopSnapshotDto
} from "./index";

describe("contracts package", () => {
  it("exports directional message unions", () => {
    expectTypeOf<FromExtensionMessage>().toMatchTypeOf<
      | { type: "video-context"; payload: VideoStateSnapshot }
      | { type: "time-update"; payload: VideoStateSnapshot }
      | { type: "playback-rate"; payload: VideoStateSnapshot }
      | { type: "page-url-changed"; payload: { pageUrl: string; title?: string } }
      | { type: "video-ended"; payload: { pageUrl?: string } }
      | {
          type: "loop-started";
          payload: {
            mode: "single" | "ab";
            startMs: number;
            endMs: number;
            startCueIndex: number | null;
            endCueIndex: number | null;
            anchorCueIndex: number | null;
            origin: "single-loop" | "ab-loop";
          };
        }
      | { type: "loop-cleared"; payload: Record<string, never> }
    >();

    expectTypeOf<ToExtensionMessage>().toMatchTypeOf<
      | { type: "control"; action: "seek"; payload: { time: number } }
      | { type: "control"; action: "pause"; payload: Record<string, never> }
      | { type: "control"; action: "play"; payload: Record<string, never> }
      | {
          type: "control";
          action: "loop";
          payload: {
            mode: "single" | "ab";
            startMs: number;
            endMs: number;
            startCueIndex: number | null;
            endCueIndex: number | null;
            anchorCueIndex: number | null;
            origin: "single-loop" | "ab-loop";
          };
        }
      | { type: "control"; action: "stopLoop"; payload: Record<string, never> }
    >();

    expectTypeOf<LoopSnapshotDto["status"]>().toEqualTypeOf<"running">();
  });
});
```

- [ ] **Step 2: Run the contracts test and verify it fails because the package does not exist yet**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm exec vitest run packages/contracts/src/contracts.test.ts
```

Expected: FAIL with module-resolution errors because `packages/contracts` and its exports do not exist yet.

- [ ] **Step 3: Implement the contracts package with directional message unions and a stable public export**

```ts
// packages/contracts/src/core/loop.ts
export type LoopMode = "single" | "ab";
export type LoopOrigin = "single-loop" | "ab-loop";
export type LoopBoundaryTransition = "none" | "loop-wrap";
export type ProgrammaticSeekReason = "none" | "manual-control" | "loop-wrap";

export interface LoopSessionDto {
  mode: LoopMode;
  startMs: number;
  endMs: number;
  startCueIndex: number | null;
  endCueIndex: number | null;
  anchorCueIndex: number | null;
  origin: LoopOrigin;
}

export interface LoopSnapshotDto extends LoopSessionDto {
  status: "running";
  boundaryTransition: LoopBoundaryTransition;
  programmaticSeekReason: ProgrammaticSeekReason;
}
```

```ts
// packages/contracts/src/messages/from-extension.ts
import type { LoopSessionDto } from "../core/loop";
import type { VideoStateSnapshot } from "../core/video";

export type FromExtensionMessage =
  | { type: "video-context"; payload: VideoStateSnapshot }
  | { type: "time-update"; payload: VideoStateSnapshot }
  | { type: "playback-rate"; payload: VideoStateSnapshot }
  | { type: "page-url-changed"; payload: { pageUrl: string; title?: string } }
  | { type: "video-ended"; payload: { pageUrl?: string } }
  | { type: "loop-started"; payload: LoopSessionDto }
  | { type: "loop-cleared"; payload: Record<string, never> };
```

```ts
// packages/contracts/src/messages/to-extension.ts
import type { LoopSessionDto } from "../core/loop";

export type ToExtensionMessage =
  | { type: "control"; action: "seek"; payload: { time: number } }
  | { type: "control"; action: "pause"; payload: Record<string, never> }
  | { type: "control"; action: "play"; payload: Record<string, never> }
  | { type: "control"; action: "loop"; payload: LoopSessionDto }
  | { type: "control"; action: "stopLoop"; payload: Record<string, never> };
```

```ts
// packages/contracts/src/index.ts
export * from "./core/loop";
export * from "./core/playback";
export * from "./core/video";
export * from "./core/transport";
export * from "./messages/from-extension";
export * from "./messages/to-extension";
```

```json
{
  "name": "@immersive-subs/contracts",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run src/contracts.test.ts"
  },
  "devDependencies": {
    "typescript": "6.0.2",
    "vitest": "4.1.4"
  }
}
```

- [ ] **Step 4: Run the contracts package test and verify it passes**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/contracts test
pnpm --filter @immersive-subs/contracts typecheck
```

Expected: PASS for both commands, with `@immersive-subs/contracts` exporting the directional protocol surface and compiling cleanly.

- [ ] **Step 5: Commit the contracts package**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add packages/contracts package.json pnpm-lock.yaml
git commit -m "feat: add shared contracts workspace package"
```

### Task 3: Convert The Extension To Consume Shared Contracts

**Files:**
- Modify: `apps/extension/package.json`
- Modify: `apps/extension/tsconfig.json`
- Modify: `apps/extension/esbuild.config.ts`
- Modify: `apps/extension/vitest.config.ts`
- Modify: `apps/extension/src/shared/types.ts`
- Modify: `apps/extension/src/background.ts`
- Modify: `apps/extension/src/background/desktop/DesktopMessageHandler.ts`
- Modify: `apps/extension/src/background/messaging/ContentMessageRouter.ts`
- Modify: `apps/extension/src/connection/MessageSender.ts`
- Modify: `apps/extension/src/content/index.ts`
- Test: `apps/extension/src/background/desktop/DesktopMessageHandler.test.ts`
- Test: `apps/extension/src/video/LoopController.test.ts`

- [ ] **Step 1: Add a failing extension test that proves shared commands come from the contracts package**

```ts
import { describe, expect, it, vi } from "vitest";
import type { ToExtensionMessage } from "@immersive-subs/contracts";
import { DesktopMessageHandler } from "./DesktopMessageHandler";

describe("DesktopMessageHandler", () => {
  it("handles loop commands shaped by shared contracts", () => {
    const controlHandler = {
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
      loop: vi.fn(),
      stopLoop: vi.fn()
    };

    const handler = new DesktopMessageHandler(controlHandler);

    const message: ToExtensionMessage = {
      type: "control",
      action: "loop",
      payload: {
        mode: "ab",
        startMs: 1000,
        endMs: 2000,
        startCueIndex: 3,
        endCueIndex: 4,
        anchorCueIndex: 3,
        origin: "ab-loop"
      }
    };

    handler.handle(message);
    expect(controlHandler.loop).toHaveBeenCalledWith(message.payload);
  });
});
```

- [ ] **Step 2: Run the extension test and verify it fails before shared imports are wired**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/extension test -- src/background/desktop/DesktopMessageHandler.test.ts
```

Expected: FAIL because the extension package does not yet depend on `@immersive-subs/contracts` and the handler is still typed against local protocol definitions.

- [ ] **Step 3: Update the extension package and replace duplicated transport types with imports from `@immersive-subs/contracts`**

```json
{
  "name": "@immersive-subs/extension",
  "private": true,
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "npm run typecheck && npm run build:chrome && npm run build:firefox",
    "build:chrome": "tsx ./esbuild.config.ts chrome",
    "build:firefox": "tsx ./esbuild.config.ts firefox",
    "test": "vitest run"
  },
  "dependencies": {
    "@immersive-subs/contracts": "workspace:*"
  }
}
```

```ts
// apps/extension/src/background/desktop/DesktopMessageHandler.ts
import type { ToExtensionMessage } from "@immersive-subs/contracts";

export class DesktopMessageHandler {
  constructor(private readonly controlHandler: {
    seek(time: number): void;
    pause(): void;
    play(): void;
    loop(payload: Extract<ToExtensionMessage, { action: "loop" }>["payload"]): void;
    stopLoop(): void;
  }) {}

  handle(message: ToExtensionMessage) {
    if (message.type !== "control") {
      return;
    }

    switch (message.action) {
      case "seek":
        this.controlHandler.seek(message.payload.time);
        break;
      case "pause":
        this.controlHandler.pause();
        break;
      case "play":
        this.controlHandler.play();
        break;
      case "loop":
        this.controlHandler.loop(message.payload);
        break;
      case "stopLoop":
        this.controlHandler.stopLoop();
        break;
    }
  }
}
```

```ts
// apps/extension/src/connection/MessageSender.ts
import type { FromExtensionMessage } from "@immersive-subs/contracts";

export function serializeMessage(message: FromExtensionMessage) {
  return JSON.stringify(message);
}
```

- [ ] **Step 4: Run the extension tests and typecheck after the shared imports land**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/extension test
pnpm --filter @immersive-subs/extension typecheck
```

Expected: PASS, with extension transport code compiling against shared contracts and no local duplicate protocol definitions remaining for cross-app traffic.

- [ ] **Step 5: Commit the extension contracts adoption**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add apps/extension pnpm-lock.yaml
git commit -m "refactor: move extension protocol types to shared contracts"
```

### Task 4: Convert The Desktop App To Consume Shared Contracts

**Files:**
- Modify: `apps/desktop-app/package.json`
- Modify: `apps/desktop-app/tsconfig.json`
- Modify: `apps/desktop-app/tsconfig.preload.json`
- Modify: `apps/desktop-app/tsconfig.renderer.json`
- Modify: `apps/desktop-app/vitest.config.ts`
- Modify: `apps/desktop-app/src/renderer/testingStackUpgrade.test.ts`
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/main/connectionManager.ts`
- Modify: `apps/desktop-app/src/main/stateManager.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/stateHandlers.ts`
- Test: `apps/desktop-app/src/renderer/testingStackUpgrade.test.ts`

- [ ] **Step 1: Add a failing desktop assertion that enforces contracts-package consumption and final workspace paths**

```ts
it("routes desktop transport typing through the shared contracts package", () => {
  const packageJson = readJson<{
    dependencies?: Record<string, string>;
  }>(path.join(desktopAppRoot, "package.json"));
  const mainTypes = readText(path.join(desktopAppRoot, "src/main/types.ts"));
  const testingUpgrade = readText(path.join(desktopAppRoot, "src/renderer/testingStackUpgrade.test.ts"));

  expect(packageJson.dependencies?.["@immersive-subs/contracts"]).toBe("workspace:*");
  expect(mainTypes).toContain('from "@immersive-subs/contracts"');
  expect(mainTypes).not.toContain("export interface ExtensionMessage");
  expect(testingUpgrade).toContain('const extensionRoot = path.resolve(repoRoot, "apps", "extension")');
});
```

- [ ] **Step 2: Run the desktop renderer test and verify it fails before desktop imports are updated**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/testingStackUpgrade.test.ts
```

Expected: FAIL because the desktop package still defines its own transport types and old repo-path assertions.

- [ ] **Step 3: Update the desktop package manifest, tsconfig inheritance, and transport types to import from shared contracts**

```json
{
  "name": "@immersive-subs/desktop-app",
  "type": "module",
  "dependencies": {
    "@immersive-subs/contracts": "workspace:*"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["DOM", "DOM.Iterable", "ES2024"],
    "types": ["node"],
    "resolveJsonModule": true
  },
  "include": ["src/main/**/*", "src/common/**/*"],
  "exclude": ["src/preload.cts", "src/renderer/**/*"]
}
```

```ts
// apps/desktop-app/src/main/types.ts
export type {
  FromExtensionMessage as ExtensionMessage,
  ToExtensionMessage as DesktopControlCommandMessage,
  LoopMode,
  LoopOrigin,
  LoopSnapshotDto,
  VideoStateSnapshot
} from "@immersive-subs/contracts";
```

```ts
// apps/desktop-app/src/main/connectionManager.ts
import type { FromExtensionMessage, ToExtensionMessage } from "@immersive-subs/contracts";
```

- [ ] **Step 4: Run the desktop renderer tests and typechecks after replacing duplicated protocol definitions**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app test:renderer
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
pnpm --filter @immersive-subs/desktop-app build:main
```

Expected: PASS, with desktop tests resolving the moved repo paths and the desktop main-process protocol surface now importing from `@immersive-subs/contracts`.

- [ ] **Step 5: Commit the desktop contracts adoption**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add apps/desktop-app pnpm-lock.yaml
git commit -m "refactor: move desktop protocol types to shared contracts"
```

### Task 5: Finalize Root Workflows, Documentation, And Repository Verification

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `apps/desktop-app/src/renderer/testingStackUpgrade.test.ts`
- Test: `apps/desktop-app/src/renderer/monorepoWorkspace.test.ts`
- Test: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Add a failing desktop repo-level assertion for final command surface and lockfile cleanup**

```ts
it("keeps final workspace commands and removes standalone npm lockfiles", () => {
  const rootPackage = readJson<{ scripts?: Record<string, string> }>(path.join(repoRoot, "package.json"));
  const gitignore = readText(path.join(repoRoot, ".gitignore"));

  expect(rootPackage.scripts?.["build:desktop"]).toBe("pnpm --filter @immersive-subs/desktop-app build");
  expect(rootPackage.scripts?.["build:extension"]).toBe("pnpm --filter @immersive-subs/extension build");
  expect(existsSync(path.join(repoRoot, "apps", "desktop-app", "package-lock.json"))).toBe(false);
  expect(existsSync(path.join(repoRoot, "apps", "extension", "package-lock.json"))).toBe(false);
  expect(gitignore).toContain("node_modules");
  expect(gitignore).toContain(".pnpm-store");
});
```

- [ ] **Step 2: Run the desktop repo-level test and verify it fails until root scripts and ignores are final**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/testingStackUpgrade.test.ts
```

Expected: FAIL until the root scripts, `.gitignore`, and repository cleanup match the final workspace contract.

- [ ] **Step 3: Finish documentation and repository workflow details**

```md
## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

### Desktop App

```bash
pnpm --filter @immersive-subs/desktop-app start
```

### Browser Extension

```bash
pnpm --filter @immersive-subs/extension build:chrome
pnpm --filter @immersive-subs/extension build:firefox
```
```

```gitignore
node_modules/
.pnpm-store/
dist/
out/
.vitest-a/
.vitest-traces/
```

- [ ] **Step 4: Run the full repository verification suite from the workspace root**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm typecheck
pnpm test
pnpm build
```

Expected: PASS for all three commands, proving the final workspace works from the root and the contracts package is integrated into both apps.

- [ ] **Step 5: Commit the final workspace verification and docs cleanup**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add README.md .gitignore apps/desktop-app packages/contracts package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml
git commit -m "docs: finalize workspace workflows and verification"
```

## Self-Review

### Spec Coverage

- Root `pnpm workspace`: covered by Task 1 and Task 5.
- `apps/desktop-app` and `apps/extension` layout: covered by Task 1.
- `packages/contracts` as the only shared package: covered by Task 2.
- Contracts-only boundary: covered by Task 2, Task 3, and Task 4.
- Stable public export surface with no deep imports: covered by Task 2 and enforced in Task 3 and Task 4.
- Root `build` / `test` / `typecheck` workflow: covered by Task 1 and Task 5.
- Removal of duplicate cross-app protocol types: covered by Task 3 and Task 4.

### Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation markers remain.
- Every task includes explicit file paths, commands, and code snippets.
- Every verification step includes the expected pass/fail outcome.

### Type Consistency

- Shared message unions are consistently named `FromExtensionMessage` and `ToExtensionMessage`.
- Shared DTOs use `Dto` or `Snapshot` naming consistently.
- The desktop and extension tasks both depend on `@immersive-subs/contracts` through package imports rather than local mirrors.
