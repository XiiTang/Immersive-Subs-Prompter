# Official Plugin System Implementation

> Status: implemented as a bundled first-party plugin host, not a downloadable plugin package system.

## What Exists

当前 desktop app 已实现的是一套“宿主内置官方功能包开关”：

- 官方插件 manifest 与主进程贡献类型放在 `packages/plugin-sdk`
- 主进程有 `PluginHost` 和 `PluginRegistryStore`
- 插件启用状态保存在用户目录下的 `plugins/registry.json`
- 设置窗口有插件管理页
- 语音转录已经迁移到 `official.transcription`
- 转录设置存放在 `settings.plugins["official.transcription"]`
- 主窗口和设置窗口通过 `usp:plugin-catalog` 实时同步插件目录变化

这次实现不包含以下能力：

- 下载插件包
- 解压、校验、升级插件包
- 从用户目录加载独立 renderer/main 产物
- 面向第三方的开放插件生态

## Runtime Shape

当前运行时边界刻意收紧为：

- 插件都是宿主随应用一起打包的官方插件
- 用户只能启用或禁用插件，不能安装或卸载插件包
- 插件设置 section 由 manifest 声明
- 插件设置组件由 renderer 侧受控注册表解析
- 宿主仍然控制窗口、状态、IPC、设置持久化与界面骨架

对应的关键文件：

- `packages/plugin-sdk/src/manifest.ts`
- `apps/desktop-app/src/main/plugins/pluginHost.ts`
- `apps/desktop-app/src/main/plugins/pluginRegistryStore.ts`
- `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
- `apps/desktop-app/src/preload.cts`
- `apps/desktop-app/src/renderer/stores/desktop.ts`
- `apps/desktop-app/src/renderer/plugins/pluginSettingsRegistry.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`

## Deliberate Simplifications

为避免过度设计，当前实现主动移除了这些未落地能力：

- `install` / `uninstall` 插件链路
- `not-installed` / `installed-disabled` / `needs-attention` / `updating` 状态
- manifest 中未被消费的 `hostVersionRange` / `features` / `surfaces` / `resources`
- 设置窗口内部的硬编码 `pluginComponentMap`
- registry 读取时把所有异常吞成空状态的兜底

现在保留的最小状态只有：

- `disabled`
- `enabled`
- `broken`

## Current Validation

已补上的关键验证点：

- 插件目录广播会更新 renderer store
- 设置页只暴露启用/禁用，不再暴露伪安装/卸载
- registry 文件不存在时返回空状态，但损坏 JSON 会直接报错
- 转录相关 UI 仍按插件启用状态显示/隐藏

验证命令：

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- desktop.test.ts SettingsPlugins.test.ts SettingsWindowShell.test.ts pluginRegistryStore.test.ts
pnpm --filter @immersive-subs/desktop-app test:renderer:browser -- SubtitleView.browser.test.ts SettingsWindowShell.browser.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck
```
