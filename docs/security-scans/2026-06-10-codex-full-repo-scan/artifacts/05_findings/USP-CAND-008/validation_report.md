# Validation Report: USP-CAND-008

## Finding

yt-dlp updater executes downloaded assets without content verification

## Decision

- Status: reportable
- Severity hypothesis: medium
- Confidence: high

## Affected Lines

- `apps/desktop-app/src/main/ytDlpManager.ts:69-82`
- `apps/desktop-app/src/main/ytDlpManager.ts:124-139`
- `apps/desktop-app/src/main/subtitleService.ts:172-180`

## Method And Evidence

Reviewed ytDlpManager.ts and subtitleService.ts. The ytDlpManager focused test currently fails before the release-fetch assertion because Electron app.isReady is undefined in the isolated test environment, but the static path is direct: fetch release JSON, download browser_download_url, write bytes, chmod 0755, spawn later.

## Dataflow

GitHub releases/latest JSON -> asset browser_download_url -> downloadBinary fetches bytes -> fs.writeFile and fs.rename to userData/yt-dlp -> ensurePermissions chmod 0755 -> SubtitleService runCommand spawns the binary.

## Counterevidence And Proof Gaps

The path executes during runtime binary refresh. Attackers need compromise of the upstream release, release API/asset delivery, local trust store/TLS, or a comparable supply-chain position. Counterevidence: HTTPS and GitHub asset name selection reduce accidental tampering, but they do not provide executable content integrity.
