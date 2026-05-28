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

- [ ] 删除孤儿设置组件和陈旧的设置测试脚手架。
  - 证据：`apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue` 只挂载 `general`、`profiles` 和 `plugins`。
  - 孤儿候选：`apps/desktop-app/src/renderer/components/settings/SettingsAppearance.vue`、`apps/desktop-app/src/renderer/components/settings/SettingsCache.vue`。
  - 相关源码：`apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`、`apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`。
  - 问题：缓存 UI 已移入全局设置，但旧缓存组件和相关测试仍然保留。
  - 建议方向：删除未使用组件，以及只服务于已移除设置分区的测试和 stub。

- [ ] 去重 URL 规则匹配逻辑。
  - 证据：`apps/desktop-app/src/common/urlRuleMatcher.ts` 和 `apps/extension/src/shared/url-rule-matcher.ts` 内容完全重复。
  - 问题：共享领域逻辑分散在桌面端和扩展端两份副本中，后续容易漂移。
  - 建议方向：迁移到共享包，只保留一套实现和测试。

- [ ] 统一桌面端和扩展端的 endpoint 解析。
  - 证据：`apps/desktop-app/src/common/networkEndpoints.ts` 和 `apps/extension/src/shared/endpoint-utils.ts` 实现了不同的解析和校验规则。
  - 问题：桌面端会拒绝一些扩展端接受的值，包括更宽泛的协议处理、更弱的端口和 host 校验。
  - 建议方向：使用同一个共享 parser，或把扩展端 parser 收窄到桌面端生成的精确 endpoint 格式。

- [ ] 将默认设置收敛为单一事实来源。
  - 证据：默认值分散在 `apps/desktop-app/src/main/default-settings.json`、`apps/desktop-app/src/main/settings/constants.ts` 和 `apps/desktop-app/src/renderer/stores/desktop/defaults.ts`。
  - 问题：不同来源的值已经不一致，例如 profile 字号和全局行为默认值。
  - 建议方向：建立一个 canonical default object/factory，删除与产品默认值不一致的兼容式 fallback 常量。

- [ ] 在继续加功能前重新评估插件架构。
  - 证据：`apps/desktop-app/src/main/plugins/pluginHost.ts` 只支持 bundled 插件；`apps/desktop-app/src/main/WindowController.ts` 手动注册官方插件；`apps/desktop-app/src/renderer/plugins/pluginSettingsRegistry.ts` 硬编码设置组件。
  - 问题：SDK、host、registry 多层结构当前更像没有真实第三方加载能力的抽象层。
  - 建议方向：要么补齐真正的插件边界，要么在需要外部插件之前，把官方功能折回一等模块。

## 低优先级

- [ ] 移除字幕组件中重复的翻译 fallback helper。
  - 证据：`TranscriptBlock.vue`、`TranscriptSurface.vue` 和 `CueAnchorRail.vue` 都实现了相似的 `fallbackTranslate` / `translate` 逻辑。
  - 问题：规模不大，但属于不必要重复。
  - 建议方向：抽一个很小的共享 helper，或要求父层统一提供翻译函数。

- [ ] 简化 FasterWhisper 压缩包解压 fallback 链。
  - 证据：`apps/desktop-app/src/main/fasterWhisperManager.ts` 依次尝试 7z、tar、PowerShell，但包资产是 `.7z`，PowerShell 路径偏向 zip 解压。
  - 问题：fallback 链里包含很可能无效或误导性的分支。
  - 建议方向：明确唯一支持的解压路径；不可用时给出清晰安装错误，不继续走无效兜底。
