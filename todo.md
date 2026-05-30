# Project Review TODO

> 2026-05-30 审查记录。项目尚未上线，优先删除旧形态兼容、无用 fallback、过渡层和未引用链路；不要为旧数据或旧代码保留迁移层。

## P1

- [ ] 修复扩展字幕异步下载跨来源写回状态的问题
  - 位置：
    - `apps/desktop-app/src/main/connectionManager.ts:470`
    - `apps/desktop-app/src/main/connectionManager.ts:472`
    - `apps/desktop-app/src/main/mediaServer/MediaServerMessageHandler.ts:134`
  - 问题：`subtitleRequestToken` 只保护扩展字幕加载本身。切到 MediaServer 后，旧的 yt-dlp promise 仍可能 resolve，并把 `subtitleTracks`、首选轨道和 `status = "ready"` 写回当前状态。
  - 处理：在来源或视频切换时让扩展字幕请求失效，或写回前同时校验当前 `activeSource` 和 `videoUrl`；补一个跨来源切换的回归测试。

## P2

- [ ] 删除或真正实现未使用的 `closeBehavior`
  - 位置：
    - `apps/desktop-app/src/main/types.ts:72`
    - `apps/desktop-app/src/main/types.ts:85`
    - `apps/desktop-app/src/common/defaultSettings.ts:15`
    - `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts:5`
    - `apps/desktop-app/src/main/window/windowManager.ts:60`
  - 问题：设置、默认值和 sanitizer 都存在，但窗口关闭逻辑没有使用它，当前始终允许关闭退出。
  - 处理：项目未上线，优先删除该字段、默认值、校验和相关测试；如果确实要保留，则立即接入窗口关闭行为。

- [ ] 删除 Whisper JSON 转写的伪时间轴 fallback
  - 位置：`apps/desktop-app/src/main/transcriptionService.ts:297`
  - 问题：当 JSON 没有 `segments` 但有 `text` 时，会用 `text.length * 20ms` 生成假字幕时间轴，掩盖 provider 或 `response_format` 配置错误，产出不可同步字幕。
  - 处理：JSON 路径要求真实 timestamp segments；纯文本只接受真实 SRT/VTT 文本，否则直接报错。

- [ ] 收紧 Faster-Whisper 下载链路的平台支持
  - 位置：
    - `apps/desktop-app/src/main/fasterWhisperManager.ts:20`
    - `apps/desktop-app/src/main/fasterWhisperManager.ts:66`
    - `apps/desktop-app/src/main/fasterWhisperManager.ts:227`
  - 问题：下载资产和二进制路径硬编码为 Windows `.exe` / `.7z`，但桌面应用存在 macOS/Linux 构建脚本，功能入口看起来是跨平台的。
  - 处理：在 UI/IPC 明确 gate 到 Windows，或补齐真实跨平台下载；未补齐前不要暴露成通用能力。

- [ ] 修复 Jellyfin/Emby 字幕刷新过早标记成功
  - 位置：
    - `apps/desktop-app/src/main/jellyfinemby/JellyfinembySubtitleLoader.ts:109`
    - `apps/desktop-app/src/main/jellyfinemby/JellyfinembySubtitleLoader.ts:177`
  - 问题：`lastSubtitleItemKey` 在实际 fetch/parse 成功前就写入。瞬时失败或解析为空时，后续同一媒体可能被跳过刷新。
  - 处理：只在拿到有效 tracks 后标记 key；或者显式维护失败状态和重试策略。

## P3

- [ ] 删除旧的 `jellyfinembyApiClient.ts` 辅助层
  - 位置：`apps/desktop-app/src/main/jellyfinembyApiClient.ts:73`
  - 问题：当前 Jellyfin/Emby 路径使用 `apps/desktop-app/src/main/jellyfinemby/*`，该旧 client/helper 没有生产引用，只会增加重复实现和漂移风险。
  - 处理：删除文件以及只为它存在的测试。

- [ ] 删除 settings sanitizer 中的旧形态兼容逻辑
  - 位置：
    - `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts:24`
    - `apps/desktop-app/src/main/settings/sanitizers/transcriptionSanitizer.ts:16`
  - 问题：仍支持旧 boolean `alwaysOnTop`，并把字符串 `extraParams` 当旧 JSON 解析，解析失败后静默落到 `{}`。
  - 处理：只接受当前最终数据结构；非法结构直接拒绝或按最终结构显式规范化。

- [ ] 删除未使用的 Faster-Whisper list models IPC/preload API
  - 位置：
    - `apps/desktop-app/src/preload.cts:31`
    - `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts:24`
  - 问题：renderer 使用 `getFasterWhisperStatus`，状态内已包含 `listDownloadedModels` 结果；额外 `listFasterWhisperModels` 暂无调用方。
  - 处理：删除 preload 暴露、IPC handler 和相关类型；需要 UI 调用时再加回。

- [ ] 清理扩展 manifest 的未用权限并统一版本号
  - 位置：
    - `apps/extension/manifest.json:4`
    - `apps/extension/manifest.json:8`
    - `apps/extension/manifest.firefox.json:4`
    - `apps/extension/manifest.firefox.json:8`
    - `apps/extension/package.json:3`
  - 问题：`alarms` 权限没有代码使用；Chrome manifest 是 `1.0.0`，Firefox manifest 和 package 是 `0.0.1`。
  - 处理：删除 `alarms` 权限，统一扩展版本来源。

- [ ] 删除未引用的截图快照产物
  - 位置：
    - `apps/desktop-app/src/renderer/components/settings/__screenshots__/**/*.png`
    - `apps/desktop-app/src/renderer/components/subtitle/__screenshots__/**/*.png`
  - 问题：`toMatchScreenshot`、`screenshot(`、`__screenshots__`、`toMatchImageSnapshot`、`compareScreenshot` 没有测试引用；这些 PNG 是未使用产物。
  - 处理：删除截图文件；如果要恢复视觉回归，先补正式 matcher 和基线维护流程。

- [ ] 删除死的便利导出和默认常量
  - 位置：
    - `apps/desktop-app/src/main/connectionAuth.ts:51`
    - `apps/desktop-app/src/main/settings/constants.ts:45`
  - 问题：`buildAuthenticatedEndpoint` 只是转发 contracts helper，且只被自己的测试引用；`DEFAULT_WS_HOST`、`DEFAULT_WS_PORT`、`DEFAULT_WS_ENDPOINT_ID` 没有生产引用。
  - 处理：删除这些转发和常量，测试直接覆盖最终 contracts helper 或实际使用路径。

- [ ] 简化 MediaServer sticky item 选择逻辑
  - 位置：`apps/desktop-app/src/main/jellyfinemby/JellyfinembySessionTracker.ts:90`
  - 问题：不同 `reportedItemId` 只有在 position 变化或正在播放时才切换；首次看到暂停的新 item 时可能继续粘住旧 item。
  - 处理：除非有明确服务端 bug 和测试，否则改成按当前 session/item 直接选择，删除 sticky 状态层。

- [ ] 收敛 renderer 侧重复的插件配置默认值和 sanitizer
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
- 未运行完整 Vitest/browser 测试套件。
