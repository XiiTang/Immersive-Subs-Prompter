# Electron Updater Release System Plan

## Goal

Replace the static `releases/latest.json` desktop update flow with a real `electron-builder` plus `electron-updater` release system for the desktop app, while keeping browser extension ZIPs as release artifacts for manual store submission.

## Final Implementation Scope

- Desktop packaging is owned by `apps/desktop-app/electron-builder.yml`.
- Electron Forge release config, Forge staging scripts, static release manifest readers, and renderer-owned download URLs are not part of the final system.
- The main process owns update checks, downloads, installation, and release state.
- The renderer can only call fixed IPC commands: get release state, check for updates, download the available update, and install the downloaded update.
- Browser extensions are built as Chrome and Firefox ZIP artifacts and uploaded beside desktop assets. Browser store update delivery remains outside the desktop updater.

## Final Contracts

### Packaging

- Product display name stays `Immersive Subs Prompter`.
- Release artifact filenames use the stable slug `Immersive-Subs-Prompter`.
- macOS produces DMG plus ZIP. The ZIP is the updater delivery artifact.
- Windows produces an NSIS installer for manual install and updater delivery.
- Linux produces AppImage for updater delivery, plus deb and rpm as manual artifacts.
- `latest.yml`, `latest-mac.yml`, and `latest-linux.yml` must reference files that are actually uploaded with the GitHub Release.

### Update Behavior

- `autoUpdater.autoDownload` is always `false`.
- `global.autoCheckUpdates` only controls the startup update check.
- Automatic checks run at startup at most once per 24 hours.
- Manual checks always run immediately.
- Updates are downloaded only after the user clicks `Download update`.
- Installation happens only after `update-downloaded` and an explicit `Install and restart` action.
- `autoInstallOnAppQuit` is disabled.

### Release Automation

- The release workflow validates package versions, typecheck, tests, extension builds, desktop updater metadata, and artifact names.
- The artifact checker verifies each updater YAML file references existing desktop release assets.
- The macOS release job requires `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.
- Missing macOS signing or notarization secrets fail the release workflow before packaging, rather than publishing ad-hoc-signed updater artifacts.
- The workflow creates or updates the GitHub Release and uploads desktop artifacts, extension ZIPs, updater metadata, blockmaps, and checksums.

## Key Files

- `apps/desktop-app/electron-builder.yml`
- `apps/desktop-app/dev-app-update.yml`
- `apps/desktop-app/src/main/appReleaseService.ts`
- `apps/desktop-app/src/main/releases/releaseState.ts`
- `apps/desktop-app/src/main/ipc/handlers/releaseHandlers.ts`
- `apps/desktop-app/src/preload.cts`
- `apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.vue`
- `scripts/release/check-builder-artifacts.mjs`
- `.github/workflows/release.yml`
- `DEPLOYMENT.md`

## Verification

Use these checks for release/update changes:

```bash
pnpm release:check
pnpm test:release-scripts
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/appReleaseService.test.ts src/main/packagingConfig.test.ts src/main/releases/releaseState.test.ts src/renderer/components/settings/SettingsReleaseUpdate.test.ts --project main --project jsdom
pnpm typecheck
pnpm test
pnpm --filter @immersive-subs/desktop-app package
pnpm --filter @immersive-subs/desktop-app dist:mac -- --publish never
```

After a local `dist:mac -- --publish never`, verify `apps/desktop-app/out/latest-mac.yml` references `Immersive-Subs-Prompter-...` files that exist in `apps/desktop-app/out`.
