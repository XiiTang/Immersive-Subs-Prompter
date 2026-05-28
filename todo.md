# TODO

> 记录 2026-05-28 项目审查发现。项目尚未上线，不需要保留旧数据兼容、迁移层、旧代码拒绝层或一次性升级检查。

## P0 - 阻塞与安全

- [ ] 修复扩展无法类型检查/构建的问题。
  - 位置：`apps/extension/src/shared/icons.ts`
  - 问题：导入了不存在的 `../../../desktop-app/src/renderer/shared/iconDefs`，这是残留的跨应用过渡层。
  - 处理：改为扩展本地 icon 定义，或移到真实 shared package；不要从桌面端源码深层导入。

- [ ] 收紧桌面端 WebSocket 鉴权。
  - 位置：`apps/desktop-app/src/main/connectionAuth.ts`
  - 问题：loopback host 直接放行，且信任任意 `chrome-extension://` / `moz-extension://` origin。
  - 处理：删除 loopback 免 token 例外；统一要求 token，必要时再固定扩展 ID 白名单。

- [ ] 修复 Faster-Whisper 平台支持和模型名校验。
  - 位置：`apps/desktop-app/src/main/fasterWhisperManager.ts`、`apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`、`apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
  - 问题：所有平台都展示下载，但实际只配置 Windows `.exe/.7z`；模型名未命中白名单时仍接受用户输入并拼接目录。
  - 处理：按平台明确支持/拒绝；模型名只允许支持列表或严格正则，拒绝路径片段。

## P1 - 核心逻辑

- [ ] 修复字幕加载失败后同视频无法自动重试的问题。
  - 位置：`apps/desktop-app/src/main/connectionManager.ts`
  - 问题：同 URL 且 `status === "error"` 时跳过字幕重载。
  - 处理：只在已有成功 tracks 或明确缓存命中时跳过，失败态应允许重试。

- [ ] 修复 Jellyfin/Emby 字幕失败后被标记为已尝试的问题。
  - 位置：`apps/desktop-app/src/main/jellyfinemby/JellyfinembySubtitleLoader.ts`
  - 问题：拉取前就写入 `lastSubtitleItemKey`，单条字幕失败被吞成 warn，后续同 item 不再刷新。
  - 处理：至少成功解析一个 track 后再标记，或失败态允许再次尝试。

- [ ] 删除扩展 server endpoint 的空列表默认兜底。
  - 位置：`apps/extension/src/background.ts`、`apps/extension/src/background/endpoints/EndpointManager.ts`
  - 问题：启动时 `fallbackToDefault: true` 会把显式空列表恢复为默认 `127.0.0.1`。
  - 处理：只在 storage key 缺失时使用默认值；用户显式清空应持久保留。

- [ ] 限制并合并扩展到桌面端的 pending 消息队列。
  - 位置：`apps/extension/src/background/desktop/DesktopConnection.ts`、`apps/extension/src/background/messaging/ContentMessageRouter.ts`
  - 问题：断线时所有消息无上限排队，重连后会发送过期的高频播放状态。
  - 处理：按 tab/type 合并快照，设置队列上限；断线时不缓存 `time-update`、`playback-rate` 等高频状态。

- [ ] 删除媒体服务器 session 的跨服务器 itemId fallback。
  - 位置：`apps/desktop-app/src/main/mediaServer/MediaServerSessionHandler.ts`
  - 问题：已有 `serverConfigId` 时仍会退回匹配任意同 `itemId` 的 session，可能选错服务器/库。
  - 处理：有 server 上下文时只匹配同 server；否则要求显式选择或保持未选中。

- [ ] 统一默认 Profile 的唯一来源。
  - 位置：`apps/desktop-app/src/main/default-settings.json`、`apps/desktop-app/src/main/settings/constants.ts`、`apps/desktop-app/src/renderer/stores/desktop/defaults.ts`
  - 问题：默认字号、gap、lineHeight 在三处不一致。
  - 处理：保留一个默认配置来源，删除复制常量和渲染端重复模板。

## P2 - 冗余、旧链路和过度兜底

- [ ] 删除 transcription 旧名称迁移逻辑和对应测试。
  - 位置：`apps/desktop-app/src/main/settings/sanitizers/transcriptionSanitizer.ts`
  - 问题：保留 `LEGACY_DEFAULT_WHISPER_CONFIG_NAME` 并迁移旧名称；项目未上线不需要。
  - 处理：删除 legacy 常量、判断分支和对应测试。

- [ ] 删除一次性升级测试和旧代码拒绝层。
  - 位置示例：`apps/desktop-app/src/renderer/electron41-upgrade.test.ts`、`apps/desktop-app/src/renderer/vue35-upgrade.test.ts`、`apps/desktop-app/src/renderer/testingStackUpgrade.test.ts`、`apps/desktop-app/src/renderer/styleConvergence.test.ts`、`apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts`、`apps/extension/src/popup-style.test.ts`
  - 问题：大量测试检查版本 pin、历史替换、源码字符串或旧样式拒绝，固化实现历史而不是产品行为。
  - 处理：删除一次性升级/迁移/旧代码拒绝测试；只保留产品行为、契约、安全边界和渲染测试。

- [ ] 简化 `ytDlpManager` 的平台映射、fallback 和失败缓存。
  - 位置：`apps/desktop-app/src/main/ytDlpManager.ts`
  - 问题：为大量 Node 平台映射同一 Linux binary；release API 失败后重复 fallback 到 latest URL；失败的 promise 会被缓存。
  - 处理：只支持明确平台；失败后清空 promise；移除重复 latest fallback，失败时清晰报错或只使用已有缓存。

- [ ] 合并低价值 IPC `try/catch` 包装。
  - 位置：`apps/desktop-app/src/main/ipc/handlers/cacheHandlers.ts`
  - 问题：多个 handler 只是 `try -> log -> throw`，没有恢复或错误转换。
  - 处理：抽统一 IPC 错误记录器，或让 rejection 直接传播。

- [ ] 让扩展发送消息真正受 contracts 约束。
  - 位置：`packages/contracts/src/messages/from-extension.ts`、`apps/extension/src/connection/MessageSender.ts`、`apps/extension/src/video/VideoDetector.ts`
  - 问题：contract 声明 `video-ended` payload 为空，但实际发送 `{ pageUrl }`；`send` 接受 `unknown`，绕过类型约束。
  - 处理：用泛型把 message type 和 payload 绑定，修正 `video-ended` payload 或 contract。

- [ ] 删除无用或过时依赖。
  - 位置：`apps/desktop-app/package.json`、`pnpm-workspace.yaml`
  - 问题：`koffi` 只被升级测试引用；`pnpm-workspace.yaml` 仍允许构建它。`lucide-vue-next` 在 lockfile 中标记 deprecated。
  - 处理：确认无运行时引用后删除 `koffi` 和 allowBuild；评估将 lucide 包迁到当前推荐包。

- [ ] 清理迁移/兼容叙述性注释。
  - 位置示例：`apps/desktop-app/src/main/jellyfinemby/JellyfinembySubtitleLoader.ts`、`apps/desktop-app/src/main/subtitleParser.ts`
  - 问题：代码注释仍保留 “Migrated from ...”“compatibility”等历史叙述。
  - 处理：保留必要行为，删除迁移来源和兼容历史描述。

## 验证记录

- `node scripts/check-silent-catches.mjs`：通过。
- `pnpm --filter @immersive-subs/contracts exec tsc -p tsconfig.json --noEmit`：通过。
- `pnpm --filter @immersive-subs/plugin-sdk exec tsc -p tsconfig.json --noEmit`：通过。
- `pnpm --filter @immersive-subs/desktop-app exec tsc --project tsconfig.json --noEmit`：通过。
- `pnpm --filter @immersive-subs/desktop-app exec tsc --project tsconfig.preload.json --noEmit`：通过。
- `pnpm --filter @immersive-subs/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json`：通过。
- `pnpm --filter @immersive-subs/extension exec tsc -p tsconfig.json --noEmit`：失败，原因是 `apps/extension/src/shared/icons.ts` 导入不存在的 `desktop-app/src/renderer/shared/iconDefs`。
