# Project cleanup todo

Completed on 2026-05-30.

The cleanup pass removed the stale fallback, compatibility, and over-exposed helper paths tracked here:

- dead exports, unused parameters/imports/loggers/CSS, and test-only utility coverage
- legacy settings load repair paths in favor of strict current-shape validation
- stale endpoint, media-server URL, word-list, IPC command, URL watcher, and word-index fallbacks
- transitional Jellyfin / Emby media-server types and broad barrels
- the private `packages/plugin-sdk` workspace package, with manifest types moved into the desktop app
- generated build/test artifacts from the working tree
- historical agent planning documents under `docs/superpowers/`

Verification run:

- `node scripts/check-silent-catches.mjs`
- `pnpm --dir packages/contracts run test`
- `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
- `pnpm --dir apps/desktop-app run build:preload`
- `pnpm --dir apps/desktop-app run typecheck:renderer`
- `pnpm --dir apps/desktop-app exec vitest run --project main`
- `pnpm --dir apps/extension exec tsc -p tsconfig.json --noEmit`
- `pnpm --dir apps/extension run test`
- `pnpm --dir apps/extension run build`
- `pnpm --filter @immersive-subs/desktop-app test:renderer`
