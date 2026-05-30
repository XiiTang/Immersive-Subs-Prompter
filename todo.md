# Project Review TODO

> 2026-05-30 审查记录。项目尚未上线，优先删除旧形态兼容、无用 fallback、过渡层和未引用链路；不要为旧数据或旧代码保留迁移层。

## P1

- [x] 修复扩展字幕异步下载跨来源写回状态的问题
  - 位置：
    - `apps/desktop-app/src/main/connectionManager.ts:470`
    - `apps/desktop-app/src/main/connectionManager.ts:472`
    - `apps/desktop-app/src/main/mediaServer/MediaServerMessageHandler.ts:134`
  - 问题：`subtitleRequestToken` 只保护扩展字幕加载本身。切到 MediaServer 后，旧的 yt-dlp promise 仍可能 resolve，并把 `subtitleTracks`、首选轨道和 `status = "ready"` 写回当前状态。
  - 处理：扩展字幕请求写回前同时校验请求 token、当前 `activeSource` 和 `videoUrl`；已补跨来源切换回归测试。

- [x] 修复 Jellyfin/Emby 字幕请求清空后晚到写回的问题
  - 位置：
    - `apps/desktop-app/src/main/jellyfinemby/JellyfinembyConnection.ts:117`
    - `apps/desktop-app/src/main/jellyfinemby/JellyfinembyConnection.ts:202`
    - `apps/desktop-app/src/main/jellyfinemby/JellyfinembySubtitleLoader.ts:44`
  - 问题：active session 切换为空或当前 session 报告 no item 时只清理 `lastSubtitleItemKey`，未让正在进行的 subtitle fetch 失效；旧请求完成后仍可能重新发出字幕 tracks。
  - 处理：清理 Jellyfin/Emby 字幕状态时同步递增请求 token；metadata refresh 和 subtitle fetch 的旧请求晚到只返回 `null`，不触发 `onSubtitles` 写回。

## P2

- [x] 删除未使用的 `closeBehavior`
  - 位置：
    - `apps/desktop-app/src/main/types.ts:72`
    - `apps/desktop-app/src/main/types.ts:85`
    - `apps/desktop-app/src/common/defaultSettings.ts:15`
    - `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts:5`
    - `apps/desktop-app/src/main/window/windowManager.ts:60`
  - 问题：设置、默认值和 sanitizer 都存在，但窗口关闭逻辑没有使用它，当前始终允许关闭退出。
  - 处理：已删除该字段、默认值、校验和测试夹具字段；不保留迁移或兼容判断。

- [x] 删除 Whisper JSON 转写的伪时间轴 fallback
  - 位置：`apps/desktop-app/src/main/transcriptionService.ts:297`
  - 问题：当 JSON 没有 `segments` 但有 `text` 时，会用 `text.length * 20ms` 生成假字幕时间轴，掩盖 provider 或 `response_format` 配置错误，产出不可同步字幕。
  - 处理：JSON 路径要求带有限 `start` / `end` 且 `end > start` 的真实 timestamp segments；纯文本只走 SRT/VTT 解析，否则直接报错。

- [x] 收紧 Faster-Whisper 下载链路的平台支持
  - 位置：
    - `apps/desktop-app/src/main/fasterWhisperManager.ts:20`
    - `apps/desktop-app/src/main/fasterWhisperManager.ts:66`
    - `apps/desktop-app/src/main/fasterWhisperManager.ts:227`
  - 问题：下载资产和二进制路径硬编码为 Windows `.exe` / `.7z`，但桌面应用存在 macOS/Linux 构建脚本，功能入口看起来是跨平台的。
  - 处理：托管二进制下载明确 gate 到 Windows；非 Windows 仅允许手动填写已有 binary path，不暴露下载按钮为可用操作。

- [x] 修复 Jellyfin/Emby 字幕刷新过早标记成功
  - 位置：
    - `apps/desktop-app/src/main/jellyfinemby/JellyfinembySubtitleLoader.ts:109`
    - `apps/desktop-app/src/main/jellyfinemby/JellyfinembySubtitleLoader.ts:177`
  - 问题：`lastSubtitleItemKey` 在实际 fetch/parse 成功前就写入。瞬时失败或解析为空时，后续同一媒体可能被跳过刷新。
  - 处理：只在拿到有效 tracks 后标记 key；同一媒体缺 inline streams 时在 metadata fetch 前短路；无 item 或空 tracks 会清理 key 并允许后续重试。

- [x] 收紧 settings update 对 profiles/rules/defaultProfileId 的写入校验
  - 位置：
    - `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts:115`
    - `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts:123`
    - `apps/desktop-app/src/main/settings/sanitizers/ruleSanitizer.ts:40`
  - 问题：`updateSettings` 对 `profiles`、`rules`、`defaultProfileId` 仍走读盘 sanitizer 路径，非法 profile/rule 会被静默规范化、丢弃或忽略。
  - 处理：写入路径只接受当前完整结构；非法 profile/rule/defaultProfileId、unsupported profile font family、dangling transcription activeConfigId patch 直接抛错，依赖 renderer 现有 rollback。

## P3

- [x] 删除旧的 `jellyfinembyApiClient.ts` 辅助层
  - 位置：`apps/desktop-app/src/main/jellyfinembyApiClient.ts:73`
  - 问题：当前 Jellyfin/Emby 路径使用 `apps/desktop-app/src/main/jellyfinemby/*`，该旧 client/helper 没有生产引用，只会增加重复实现和漂移风险。
  - 处理：删除文件以及只为它存在的测试。

- [x] 删除 settings sanitizer 中的旧形态兼容逻辑
  - 位置：
    - `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts:24`
    - `apps/desktop-app/src/main/settings/sanitizers/transcriptionSanitizer.ts:16`
  - 问题：仍支持旧 boolean `alwaysOnTop`，并把字符串 `extraParams` 当旧 JSON 解析，解析失败后静默落到 `{}`。
  - 处理：只接受当前最终数据结构；非法结构直接拒绝或按最终结构显式规范化。

- [x] 删除未使用的 Faster-Whisper list models IPC/preload API
  - 位置：
    - `apps/desktop-app/src/preload.cts:31`
    - `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts:24`
  - 问题：renderer 使用 `getFasterWhisperStatus`，状态内已包含 `listDownloadedModels` 结果；额外 `listFasterWhisperModels` 暂无调用方。
  - 处理：删除 preload 暴露、IPC handler 和相关类型；需要 UI 调用时再加回。

- [x] 清理扩展 manifest 的未用权限并统一版本号
  - 位置：
    - `apps/extension/manifest.json:4`
    - `apps/extension/manifest.json:8`
    - `apps/extension/manifest.firefox.json:4`
    - `apps/extension/manifest.firefox.json:8`
    - `apps/extension/package.json:3`
  - 问题：`alarms` 权限没有代码使用；Chrome manifest 是 `1.0.0`，Firefox manifest 和 package 是 `0.0.1`。
  - 处理：删除 `alarms` 权限，统一扩展版本来源。

- [x] 删除未引用的截图快照产物
  - 位置：
    - `apps/desktop-app/src/renderer/components/settings/__screenshots__/**/*.png`
    - `apps/desktop-app/src/renderer/components/subtitle/__screenshots__/**/*.png`
  - 问题：`toMatchScreenshot`、`screenshot(`、`__screenshots__`、`toMatchImageSnapshot`、`compareScreenshot` 没有测试引用；这些 PNG 是未使用产物。
  - 处理：删除截图文件；如果要恢复视觉回归，先补正式 matcher 和基线维护流程。

- [x] 删除死的便利导出和默认常量
  - 位置：
    - `apps/desktop-app/src/main/connectionAuth.ts:51`
    - `apps/desktop-app/src/main/settings/constants.ts:45`
  - 问题：`buildAuthenticatedEndpoint` 只是转发 contracts helper，且只被自己的测试引用；`DEFAULT_WS_HOST`、`DEFAULT_WS_PORT`、`DEFAULT_WS_ENDPOINT_ID` 没有生产引用。
  - 处理：删除这些转发和常量，测试直接覆盖最终 contracts helper 或实际使用路径。

- [x] 简化 MediaServer sticky item 选择逻辑
  - 位置：`apps/desktop-app/src/main/jellyfinemby/JellyfinembySessionTracker.ts:90`
  - 问题：不同 `reportedItemId` 只有在 position 变化或正在播放时才切换；首次看到暂停的新 item 时可能继续粘住旧 item。
  - 处理：除非有明确服务端 bug 和测试，否则改成按当前 session/item 直接选择，删除 sticky 状态层。

- [x] 收敛 renderer 侧重复的插件配置默认值和 sanitizer
  - 位置：`apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts`
  - 问题：renderer 本地维护 word lookup、Jellyfin/Emby 等插件配置默认值和兜底逻辑，和 main 侧 sanitizer/defaults 重复。
  - 处理：把最终默认值和结构校验放到 common/contracts，或只消费 main 返回的已清洗 settings，避免双路径 fallback。

## Verification Notes

- 审查期间通过的只读检查：
  - `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`
  - `pnpm --dir apps/extension exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit`
  - `node scripts/check-silent-catches.mjs`
- 最初审查阶段未改代码；后续清理轮已补跑完整 main/jsdom/browser 套件。
- 2026-05-30 P3 清理执行后通过：
  - `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`
  - `pnpm --dir apps/extension exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit`
  - `node scripts/check-silent-catches.mjs`
  - `pnpm --dir apps/extension run build`
  - `pnpm --dir apps/desktop-app exec vitest run --project main`
  - `pnpm --dir apps/desktop-app exec vitest run --project jsdom`
  - `pnpm --dir apps/desktop-app exec vitest run --project browser`
  - `pnpm --dir apps/extension exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir packages/contracts exec vitest run src/network-endpoints.test.ts`
- 2026-05-30 P1/P2 跟进清理后通过：
  - `pnpm --dir apps/desktop-app exec vitest run --project jsdom src/renderer/App.test.ts`
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/connectionManager.test.ts src/main/transcriptionService.test.ts src/main/fasterWhisperManager.test.ts src/main/settings/appSettingsSanitizer.test.ts`
  - `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`
  - `pnpm --dir apps/extension exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit`
  - `node scripts/check-silent-catches.mjs`
  - `pnpm --dir apps/extension run build`
  - `pnpm --dir packages/contracts exec vitest run src/network-endpoints.test.ts`
  - `pnpm --dir apps/desktop-app exec vitest run --project main`
  - `pnpm --dir apps/desktop-app exec vitest run --project jsdom`
  - `pnpm --dir apps/desktop-app exec vitest run --project browser`
  - `git diff --check`
- 2026-05-30 Jellyfin/Emby 字幕 key 修复后通过：
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/jellyfinemby/JellyfinembyConnection.test.ts`
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/jellyfinemby/JellyfinembyConnection.test.ts src/main/settings/SettingsStore.test.ts`
  - `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`
  - `pnpm --dir apps/desktop-app exec vitest run --project main`
  - `node scripts/check-silent-catches.mjs`
- 2026-05-30 review 跟进修复后通过：
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/jellyfinemby/JellyfinembyConnection.test.ts`
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/settings/SettingsStore.test.ts`
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/jellyfinemby/JellyfinembyConnection.test.ts src/main/settings/SettingsStore.test.ts`
  - `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`
  - `pnpm --dir apps/desktop-app exec vitest run --project main`
  - `node scripts/check-silent-catches.mjs`
  - `git diff --check`
- 2026-05-30 review gap cleanup 后通过：
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/jellyfinemby/JellyfinembyConnection.test.ts src/main/transcriptionService.test.ts src/main/settings/SettingsStore.test.ts`
  - `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/desktop-app exec vitest run --project main`
  - `pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`
  - `node scripts/check-silent-catches.mjs`
  - `git diff --check`
  - `pnpm --dir apps/desktop-app exec vitest run --project jsdom`
  - `pnpm --dir apps/desktop-app exec vitest run --project browser`
- 2026-05-30 review gap cleanup follow-up 后通过：
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/settings/SettingsStore.test.ts src/main/settings/appSettingsSanitizer.test.ts`
  - `pnpm --dir apps/desktop-app exec vitest run --project main`
  - `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`
  - `node scripts/check-silent-catches.mjs`
  - `git diff --check`
  - `pnpm --dir apps/desktop-app exec vitest run --project jsdom`
  - `pnpm --dir apps/desktop-app exec vitest run --project browser`
- 2026-05-30 review follow-up cleanup 后通过：
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/jellyfinemby/JellyfinembyConnection.test.ts`
  - `pnpm --dir apps/desktop-app exec vitest run --project main src/main/transcriptionService.test.ts src/main/settings/SettingsStore.test.ts`
  - `pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit`
  - `pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`
  - `pnpm --dir apps/desktop-app exec vitest run --project main`
  - `pnpm --dir apps/desktop-app exec vitest run --project jsdom`
  - `pnpm --dir apps/desktop-app exec vitest run --project browser`
  - `node scripts/check-silent-catches.mjs`
  - `git diff --check`
