# 项目清理 TODO

审查日期：2026-05-28

范围：逻辑问题、过度设计链路、冗余 fallback/兼容层、陈旧代码和无用测试。项目尚未上线，优先删除或简化旧式行为，不保留迁移、兼容或历史数据兜底路径。

## 高优先级

- [ ] 修复扩展到桌面端 WebSocket 的离线队列行为。
  - 证据：`apps/extension/src/background/desktop/DesktopConnection.ts` 保留无上限的 `pending` 数组，并在重连后刷新全部排队消息。
  - 相关源码：`apps/extension/src/background/messaging/ContentMessageRouter.ts`、`apps/extension/src/video/VideoDetector.ts`。
  - 问题：高频 `time-update` 和播放状态消息会在桌面端不可用时持续累积，重连后又回放过期状态。
  - 建议方向：高频状态只保留最新一条；只有命令类消息才允许进入小容量有界队列；或在断开期间明确丢弃状态更新。

- [ ] 明确 MediaServer 断开后的状态切换。
  - 证据：`apps/desktop-app/src/main/mediaServer/MediaServerStatusHandler.ts` 在仍有扩展连接时保留旧 `status`，同时清空媒体和会话数据。
  - 相关源码：`apps/desktop-app/src/main/stateManager.ts`。
  - 问题：active 媒体数据已清空后，状态仍可能停留在 `ready` 或 `loading`。
  - 建议方向：当前 active MediaServer source 断开时，统一切换到 `awaiting-video` 或 `idle`。

- [ ] 移除 WordLookup 的旧索引兜底。
  - 证据：`apps/desktop-app/src/main/plugins/official/wordLookup/WordLookupService.ts` 在词表路径被清空或重新加载失败时没有清空 `index`。
  - 相关测试：`apps/desktop-app/src/main/plugins/official/wordLookup/wordLookup.test.ts` 当前断言刷新失败后会保留旧索引。
  - 问题：配置已经无效后，查词仍可能返回旧词典中的结果。
  - 建议方向：路径缺失或加载失败时清空运行时索引，并更新测试为不允许旧索引继续生效。

## 中优先级

- [ ] 在继续加功能前重新评估插件架构。
  - 证据：`apps/desktop-app/src/main/plugins/pluginHost.ts` 只支持 bundled 插件；`apps/desktop-app/src/main/WindowController.ts` 手动注册官方插件；`apps/desktop-app/src/renderer/plugins/pluginSettingsRegistry.ts` 硬编码设置组件。
  - 问题：SDK、host、registry 多层结构当前更像没有真实第三方加载能力的抽象层。
  - 建议方向：要么补齐真正的插件边界，要么在需要外部插件之前，把官方功能折回一等模块。

## 低优先级

- [x] 移除字幕组件中重复的翻译 fallback helper。
  - 证据：`TranscriptBlock.vue`、`TranscriptSurface.vue` 和 `CueAnchorRail.vue` 都实现了相似的 `fallbackTranslate` / `translate` 逻辑。
  - 问题：规模不大，但属于不必要重复。
  - 建议方向：抽一个很小的共享 helper，或要求父层统一提供翻译函数。

- [x] 简化 FasterWhisper 压缩包解压 fallback 链。
  - 证据：`apps/desktop-app/src/main/fasterWhisperManager.ts` 依次尝试 7z、tar、PowerShell，但包资产是 `.7z`，PowerShell 路径偏向 zip 解压。
  - 问题：fallback 链里包含很可能无效或误导性的分支。
  - 建议方向：明确唯一支持的解压路径；不可用时给出清晰安装错误，不继续走无效兜底。
