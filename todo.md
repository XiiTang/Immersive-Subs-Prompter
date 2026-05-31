# TODO

当前无待办。

2026-05-31 已完成本轮清理：

- 移除过时的 Jellyfin/Emby client version、device id、URL item id、`structuredClone`、`crypto.randomUUID`、DOM/URL watcher fallback。
- 收窄默认值、校验器、格式化工具、logger、settings、transcript 类型的导出面。
- 删除 settings 常量桥接层和启动期 `DEFAULT_SETTINGS` 占位，主进程先加载设置再构造运行时 managers。
- 集中支持语言常量，去重 renderer clamp、Faster-Whisper IPC payload 类型、cache stats 类型形状和图标包装层。
- 折叠主进程 Jellyfin/Emby 专用 handler/resolver 命名，移除 `MediaServerConfig` alias 与 runtime service Pick 过渡层。
- 精简 endpoint manager、transcription command error、subtitle cache 路径和 README 故障排查措辞。
