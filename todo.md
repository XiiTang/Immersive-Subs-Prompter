# 项目清理待办

## 1. 移除或收敛内置插件注册/启用层

- 证据：
  - `apps/desktop-app/src/main/window/windowController.ts` 在启动时注册所有“插件”，但 `PluginHost.loadEnabledPlugins()` 只加载 `plugins/registry.json` 里已有的记录。
  - `apps/desktop-app/src/main/plugins/pluginRegistryStore.ts` 为仅内置的功能单独持久化启用、禁用和错误状态。
  - `apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts` 和 `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts` 会在对应内置插件未启用时拒绝核心功能命令。
  - `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue` 会根据插件目录的启用状态隐藏功能设置页。
  - `apps/desktop-app/src/renderer/plugins/pluginSettingsRegistry.ts` 是一个从内置 section id 到内置 Vue 组件的静态 Map，没有外部注册路径。
  - `AppSettings.plugins` 把每个内置插件配置存成 `Record<string, unknown>`，导致当前代码在 `windowController.ts`、`mediaServerController.ts` 和 renderer plugin actions 中反复转换回具体配置类型。
- 为什么值得清理：
  - 项目还未上线，也没有外部插件加载路径；当前所有插件都是应用内置功能。
  - 注册表提前引入了兼容/扩展层，并可能让已有完整默认配置的内置功能默认处于禁用状态。
- 建议清理：
  - 现阶段将转录、查词、Jellyfin/Emby 作为直接应用模块接线，或让内置模块默认启用且不再依赖单独持久化注册表。
  - 如果选择直接模块方案，删除 `pluginRegistryStore`、插件启停 IPC、插件目录状态传递，以及只覆盖该过渡层的测试。

## 2. 合并重复的字幕字号 fallback/归一化逻辑

- 证据：
  - `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue` 定义了 `MIN_SUBTITLE_FONT_SIZE`、`MAX_SUBTITLE_FONT_SIZE`、`MIN_TIMESTAMP_FONT_SIZE`、`MAX_TIMESTAMP_FONT_SIZE`、`normalizeSubtitleFontSize()` 和 `normalizeTimestampFontSize()`。
  - `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStylePreview.vue` 重新定义了同样的字幕和时间戳字号归一化逻辑，并内联了时间戳边界 `6` 和 `24`。
  - `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue` 又加入了第三处时间戳字号 fallback，无效值返回 `11`。
  - `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts` 已经校验了保存后的 profile 边界。
- 为什么值得清理：
  - 这些是覆盖已清洗设置路径的重复防御性 fallback。
  - 重复常量可能让实时字幕视图、预览和 transcript surface 之间发生漂移。
- 建议清理：
  - 将共享边界和归一化 helper 放到一个 renderer/common 模块；或者删除设置清洗后不可达的 renderer fallback。

## 3. 简化手写的设置“当前 schema”拒绝层

- 证据：
  - `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts` 维护了顶层 key 列表、完整加载校验、局部更新校验、内置插件校验、必填 key 检查，以及显式的 `"current ... setting"` 拒绝消息。
  - 每个设置域都在 `apps/desktop-app/src/main/settings/sanitizers/*.ts` 中重复维护自己的 key 列表和形状校验。
  - `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts` 专门测试拒绝“只有旧磁盘加载 sanitizer 会归一化”的值。
  - `apps/desktop-app/src/main/settings/SettingsStore.test.ts` 有大量按字段测试“拒绝本来会被归一化/默认化的值”和不完整历史形状。
- 为什么值得清理：
  - 项目还未上线，没有旧持久化设置 schema 需要专门的拒绝/迁移契约。
  - 该层重复了 TypeScript 类型、默认工厂，并让每个设置字段出现在多处。
  - 测试体量更多覆盖 legacy shape 拒绝，而不是当前用户流程。
- 建议清理：
  - 保留一个针对 renderer/IPC 设置更新的聚焦校验边界，但删除唯一目的只是拒绝旧归一化/默认化磁盘形状的代码和测试。
  - 考虑使用 defaults 加类型化 update helper 来表达当前设置，而不是为每个对象维护并行 key 数组。

## 4. 移除 yt-dlp 进程日志中不可达的 GBK 解码 try/fallback

- 证据：
  - `apps/desktop-app/src/main/subtitleService.ts` 将 `iconv.decode(chunk, "gbk")` 包在 `try/catch` 中，并调用 `swallow(..., "falling back to UTF-8")`。
  - 编码是 `iconv-lite` 支持的常量；无效字节序列会解码成替换字符，而不是抛错。
  - 本地 smoke check 用无效字节 buffer 测试，返回替换文本且没有抛错。
- 为什么值得清理：
  - catch/fallback 路径事实上是死代码，并增加了另一个被允许的 swallow 路径。
  - 它会让人误以为 Windows 输出会先按 GBK 校验，再条件性回退到 UTF-8。
- 建议清理：
  - Windows 进程输出直接按 GBK 解码，或选择一种明确的编码策略，不保留不可达的 `try/catch`。

## 5. 合并重复且已漂移的 yt-dlp 默认参数来源

- 证据：
  - `apps/desktop-app/src/common/ytdlpDefaults.ts` 定义了 `DEFAULT_YTDLP_ARGS`。
  - `apps/desktop-app/src/common/defaultSettings.ts` 硬编码了另一个不同的 `DEFAULT_PROFILE_SETTINGS.ytDlpArgs`，没有复用 `DEFAULT_YTDLP_ARGS`。
  - `apps/desktop-app/src/main/subtitleService.ts` 只在 profile 值为空时 fallback 到 `DEFAULT_YTDLP_ARGS`。
  - `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue` 把 `DEFAULT_YTDLP_ARGS` 作为 textarea placeholder，但实际默认 profile 值来自硬编码 profile setting。
- 为什么值得清理：
  - 同一个字幕下载命令路径有两套“默认值”，且已经不同，例如 `--write-auto-subs` 与 `--no-playlist` 等。
  - 这是重复 fallback/default 拆分，会让行为更难推理。
- 建议清理：
  - 让 `DEFAULT_PROFILE_SETTINGS.ytDlpArgs` 复用 canonical 常量，或明确命名 profile 专属默认值，并停止把通用常量作为 UI fallback placeholder。

## 6. 在只有 Jellyfin/Emby 时收敛通用 media-server 抽象

- 证据：
  - `apps/desktop-app/src/main/mediaServerController.ts` 暴露了通用 `MediaServerController`，但只接线 `JellyfinembySubtitleService`、`JellyfinembyTabContextRegistry`、`JellyfinembyUrlResolver` 和 Jellyfin/Emby handlers。
  - `apps/desktop-app/src/main/types.ts` 使用了 `activeSource: "mediaserver"` 和 media-server status payload 等通用状态名，但 `serverType` 是字面量 `"jellyfinemby"`。
  - `apps/desktop-app/src/main/jellyfinemby/` 为一个 provider family 放了很多 provider 专属编排层：service、connection、transport、subscription、session manager、session tracker、tab registry、URL resolver、status handler、session handler、message handler 和 subtitle loader。
- 为什么值得清理：
  - 这是在第二个 provider 出现前提前引入的未来 provider/过渡抽象。
  - 通用层增加了命名间接性和状态转换，但各处仍然需要特判 Jellyfin/Emby。
- 建议清理：
  - 现阶段将 controller/state 路径改成 Jellyfin/Emby 专属命名，或把通用 controller/handlers 收敛成更少的 provider 专属模块。
  - 等真正加入另一个后端时再重新引入通用 media-server interface。

## 7. 精简保留历史补丁意图的 UI/layout 测试

- 证据：
  - `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts` 约 1,483 行，包含大量具体布局决策测试，例如没有单独行距控件、fallback 行位置、空 draft pill、紧凑无标签 URL rule pill、固定预览顺序等。
  - `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.browser.test.ts` 约 896 行，包含多项“旧 UI 行为不存在”的断言，例如没有永久 focus-band overlay、不裁剪到 active playback window。
  - `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts` 及相关 browser tests 断言了很多旧 UI patch 里的微布局细节，例如精确 trigger-zone 行为、没有静态产品标题、固定不重叠 header slots。
  - `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts` 包含旧导航决策，例如 appearance/cache 留在 global settings 而不是独立 nav sections。
- 为什么值得清理：
  - 这些测试把历史 patch 决策锁死，使 UI 简化成本变高。
  - 很多断言更像“旧代码不能回来”的检查，而不是当前用户可见流程覆盖。
- 建议清理：
  - 保留代表性的交互和可访问性覆盖，删除或合并只断言旧布局实验不存在、或精确内部组成的测试。

## 8. 移除重复 i18n fallback 字符串和分裂的翻译来源

- 证据：
  - `apps/desktop-app/src/renderer/i18n.ts` 保留了调用点 fallback 支持，预加载默认语言，但每个 UI 调用方仍传入英文 fallback 字符串。
  - 扫描发现 desktop 和 extension 中有数百处 `t("key", "English fallback")` / `translate("key", "English fallback")` 调用。
  - `apps/desktop-app/src/renderer/locales/en.json` 和 `zh.json` 已经包含 renderer 字典，并由 `apps/desktop-app/src/renderer/i18nCoverage.test.ts` 检查。
  - `apps/desktop-app/src/main/i18n.ts` 为 tray labels 维护了另一份小型翻译表，而不是复用同一份 desktop locale source。
  - `apps/extension/_locales/*/messages.json` 又维护了另一份翻译来源，并且 popup 也有调用点 fallback。
- 为什么值得清理：
  - 英文 UI 文案在组件、locale JSON、extension locale JSON 和 main-process 字典中重复。
  - fallback 机制会掩盖缺失 key，而 locale coverage tests 的目的正是发现缺失 key。
- 建议清理：
  - 将字典查找作为主契约，仅为真正动态/插件提供的 label 保留调用点 fallback。
  - 将 main-process tray 字符串与 desktop locale source 统一，或生成 typed keys/shared constants，避免手写重复文案。

## 9. 删除旧的 string/null 字幕轨道 IPC payload 分支

- 证据：
  - `apps/desktop-app/src/preload.cts` 暴露 `selectSubtitleTrack(trackId, role)`，并始终用对象 payload `{ trackId, role }` 调用 `usp:select-track`。
  - `apps/desktop-app/src/renderer/stores/desktop/actions/playbackActions.ts` 用 `(trackId, role)` 调用 preload API，因此当前 renderer 路径到 main 时始终是对象形状。
  - `apps/desktop-app/src/main/ipc/handlers/subtitleHandlers.ts` 直接透传 IPC payload。
  - `apps/desktop-app/src/main/connectionManager.ts` 仍接受 `TrackSelectionPayload | string | null`，并 fallback 到把非对象 payload 当成 primary track string/null。
- 为什么值得清理：
  - string/null 分支是旧 IPC 兼容路径；没有已发布 renderer 或外部调用方需要保留。
  - 当前 API 已经显式携带 role，但这里仍保留 runtime shape detector 和隐式 primary-track fallback。
- 建议清理：
  - main handler 只接受当前 `{ trackId, role }` payload 形状；如有需要在 IPC 边界校验；删除 `isTrackSelectionPayload()` 以及只覆盖旧 scalar payload 的测试。

## 10. 从单一来源生成浏览器专属 extension manifest

- 证据：
  - `apps/extension/manifest.json` 和 `apps/extension/manifest.firefox.json` 重复了相同的 name、locale、description、author、permissions、host permissions、content script、action 和共享 asset 字段。
  - 真正的浏览器差异很小：Chrome 使用 service worker background，Firefox 使用 background scripts 加 Gecko metadata、不同 icon 覆盖和额外 content security policy。
  - `apps/extension/esbuild.config.ts` 已经有 target map，并会注入 package version 写出最终 manifest。
- 为什么值得清理：
  - 两个手工维护的完整 manifest 是重复 build source split，共享字段可能静默漂移。
  - 既然 build script 已经按 target 产出结果，就不需要保留两份完整 manifest 文件。
- 建议清理：
  - 保留一个 base manifest，再在 build script 中维护小型 Chrome/Firefox override 对象；或存放最小 JSON fragment，在 `copyManifest()` 中合并。

## 11. 收紧 preload bridge 的类型，而不是继续携带宽泛 `any` payload

- 证据：
  - `apps/desktop-app/src/renderer/global.d.ts` 将 `window.usp` 暴露为 `RendererApi`，该类型从 `apps/desktop-app/src/preload.cts` 推断。
  - `apps/desktop-app/src/preload.cts` 仍在 state、playback、plugin catalog、word lookup、word lookup window payload 和 video controls 上使用 `Promise<any>`、`Listener<any>`、`any[]`、`command: any`、`payload: any`。
  - 代码库里已经有匹配类型：`apps/desktop-app/src/main/types.ts` 中的 `DesktopState`、`PlaybackState`、`VideoControlCommand`；`apps/desktop-app/src/main/plugins/pluginTypes.ts` 中的 `PluginCatalogRow`；`apps/desktop-app/src/main/window/wordLookupWindowManager.ts` 中的 `WordLookupWindowOpenPayload`；以及 `apps/desktop-app/src/main/plugins/official/wordLookup/wordLookupTypes.ts` 中的查词结果/状态类型。
- 为什么值得清理：
  - 这个 bridge 像兼容/逃逸层，但当前只有一个 renderer，也没有已发布 preload API 需要保留。
  - 它允许过时 payload 形状继续存在于 renderer 代码/测试中，并削弱了最容易清理的 IPC 契约。
- 建议清理：
  - 用已有具体类型或小型导出的 IPC payload/result 类型替换 `preload.cts` 中剩余的 `any` 签名，让 `RendererApi` 把更窄的契约传播到 renderer tests 和 stores。

## 12. 删除未引用的旧图标资源

- 证据：
  - `assets/icons/add.svg` 和 `assets/icons/delete.svg` 已被跟踪，但搜索 `add.svg`、`delete.svg` 和 `assets/icons` 没有发现 runtime、build 或文档引用。
  - renderer 现在通过 `apps/desktop-app/src/renderer/components/icons/index.ts` 使用 `@lucide/vue`，其中包括 `IconAdd` 和 `IconDelete`。
  - `apps/desktop-app/resources/tray-icon.png` 和 `tray-icon@2x.png` 已被跟踪，但代码和 packaging 只通过 `windowController.ts` 与 `forge.config.mjs` 引用 `trayTemplate.png` / `trayTemplate@2x.png`。
- 为什么值得清理：
  - 这些看起来是早期 UI/tray 实现遗留下来的静态资源。
  - 同时保留旧彩色 tray icons 和当前 template tray icons 会让打包资源更难审计。
- 建议清理：
  - 如果没有外部 release packaging 仍引用它们，删除 `assets/icons/add.svg`、`assets/icons/delete.svg`、`apps/desktop-app/resources/tray-icon.png` 和 `apps/desktop-app/resources/tray-icon@2x.png`。

## 13. 移除未使用的 bundled `yt-dlp` resource fallback 路径

- 证据：
  - `apps/desktop-app/resources/yt-dlp/` 只通过空 `.gitkeep` 被跟踪。
  - `apps/desktop-app/forge.config.mjs` 仍将 `resources/yt-dlp` 作为 `extraResource` 打包，`apps/desktop-app/src/main/packagingConfig.test.ts` 也断言它被包含。
  - `apps/desktop-app/src/main/ytDlpManager.ts` 只在 `app.getPath("userData")/yt-dlp` 下解析 binary，下载/更新也在该位置，从不检查 `resolveBundledResource("yt-dlp", ...)`。
  - `README.md` 和 `DEPLOYMENT.md` 描述了手动预放 binary 到 `resources/yt-dlp`，但也说明 runtime 首次启动仍会下载到 user data。
- 为什么值得清理：
  - 这是一个没有 active runtime 支持、repo 内也没有 bundled binary 的离线/手动恢复 fallback 路径。
  - 它为默认不会实际使用的路径增加了 packaging、test 和 docs 表面积。
- 建议清理：
  - 要么在下载前实现真实的 bundled-binary lookup，要么删除空 resource 目录、`extraResource` 条目、packaging 断言，以及宣传手动预打包的文档。

## 14. 重命名或删除过时的 `test:renderer` desktop 测试包装脚本

- 证据：
  - `apps/desktop-app/scripts/run-renderer-tests.mjs` 调用 Vitest 时使用 `--project browser --project jsdom --project main`。
  - `apps/desktop-app/package.json` 将 `test` 和 `test:renderer` 都映射到该 wrapper，因此 `test:renderer` 现在也会跑 main-process tests。
  - 根 `package.json` 将 `test:desktop` 映射到 `pnpm --filter @immersive-subs/desktop-app test:renderer`。
  - `README.md` 仍将该命令描述为“Run the desktop renderer suite”。
- 为什么值得清理：
  - 这个名字是 wrapper 只覆盖 renderer tests 时留下的过时兼容/过渡别名。
  - `test:renderer`、`test:desktop` 和 package `test` 的名称与实际执行内容不一致，让测试入口更难理解。
- 建议清理：
  - 将 wrapper/script 重命名为 `test:desktop` 或 `test:all`；保留显式 `test:renderer:browser` / `test:renderer:jsdom` 用于 renderer-only 运行；同步更新 README 和 root scripts。

## 15. 移除重复的“default profile 缺失”运行时 fallback

- 证据：
  - `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts` 拒绝任何不是固定 `DEFAULT_PROFILE_ID` 的 saved `defaultProfileId`。
  - `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts` 要求 fallback profile 存在且必须是最后一个 profile。
  - `apps/desktop-app/src/main/stateManager.ts` 在初始 state 和 `getDefaultProfile()` 中仍从 `settings.defaultProfileId` fallback 到 `settings.profiles[0]`。
  - `apps/desktop-app/src/renderer/stores/desktop.ts` 在 `activeProfile` 和 `editingProfile` getters 中重复了同样的 first-profile fallback。
  - `apps/desktop-app/src/renderer/stores/desktop/actions/profileActions.ts` 在请求编辑 profile 不存在时，仍从 `settings.defaultProfileId` fallback 到 `settings.profiles[0].id`。
- 为什么值得清理：
  - 在当前 settings sanitizer 和 store update validators 运行后，first-profile fallback 不可达。
  - 它保留了对无效 settings 形状的防御行为，但项目不需要旧 profile schema 或损坏 schema 的兼容。
- 建议清理：
  - 在 settings 边界将缺失 fallback profile 当作 invariant violation，然后简化 state/profile 代码，直接使用固定 fallback profile。

## 16. 合并重复的 `swallow` / error-report helper 表面

- 证据：
  - `apps/desktop-app/src/main/errors.ts` 定义了带结构化 main-process logging 的 `reportError()` 和 `swallow()`。
  - `apps/desktop-app/src/renderer/utils/errorBus.ts` 定义了另一个 `reportError()` 和另一个 `swallow()`，契约几乎相同，都是“带 reason 的安全忽略”。
  - 搜索显示 renderer `swallow()` 当前没有调用点。
  - `apps/extension/src/shared/reportError.ts` 定义了第三个 `swallow()`，带相同的审计型注释和 console-debug 行为。
  - `scripts/check-silent-catches.mjs` 要求所有忽略错误使用 `swallow(err, context, reason)`，但背后没有单一共享 helper 或契约。
- 为什么值得清理：
  - 策略重复，真正的差异只是输出适配器不同：main logger、renderer error bus、extension console logger。
  - 未来若要调整“什么算可接受的 swallowed error”，需要改多个文件。
- 建议清理：
  - 如有必要保留进程专属 reporting adapters，但把共同的 `swallow` 形状/格式化契约移到共享 utility；或让 lint script 明确指向各进程专属 helper。

## 17. 删除过时的未使用 sanitizer imports，并考虑启用 unused 检查

- 证据：
  - 临时 `tsc --noUnusedLocals --noUnusedParameters` 扫描 desktop main project 报告 `apps/desktop-app/src/main/settings/sanitizers/cacheSanitizer.ts` 中的 `SubtitleCacheSettings` 未使用。
  - 同一扫描报告 `apps/desktop-app/src/main/settings/sanitizers/ruleSanitizer.ts` 中的 `ProfileRule` 未使用。
  - extension 和 contracts projects 在相同临时 flag 下没有输出未使用 symbol。
- 为什么值得清理：
  - 这些是确认的 stale imports，没有 runtime 或 type value。
  - 当前 repo 启用了 `strict`，但未启用 `noUnusedLocals` / `noUnusedParameters`，这种小型 dead code 会继续累积。
- 建议清理：
  - 删除这两个未使用 import。
  - 在评估当前误报压力后，考虑为非测试 TS configs 启用 `noUnusedLocals`。

## 18. 删除未使用的 renderer `connectionLabel` store getter

- 证据：
  - `apps/desktop-app/src/renderer/stores/desktop.ts` 定义了 `connectionLabel` getter，直接用英文格式化 extension 和 media-server 计数。
  - `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue` 从 store 和 plugin catalog 重新计算同一段连接文案，并使用 renderer i18n keys。
  - 搜索 `connectionLabel` 只找到 getter、`apps/desktop-app/src/renderer/stores/desktop/types.ts` 中的类型声明，以及 `apps/desktop-app/src/renderer/stores/desktop.test.ts` 中两条专门断言。
- 为什么值得清理：
  - 该 getter 是死的生产表面，并重复了现在属于本地化 top panel 的 UI 格式化。
  - 它的测试保留了一条未使用的英文路径，可能掩盖 store 和真实显示 label 之间的漂移。
- 建议清理：
  - 删除 getter 和 `DesktopStoreGetters.connectionLabel`，再删除只断言该未使用格式化 label 的 store 测试。

## 19. 移除 extension blacklist rules 中旧的缺失 id 归一化

- 证据：
  - `apps/extension/src/popup.ts` 使用 `crypto.randomUUID()` 创建新 blacklist rules，并持久化当前 `{ id, value }` 形状。
  - `apps/extension/src/shared/blacklist-utils.ts` 仍接受空 id 或缺失 id 的条目，并生成 `rule-${index}`。
  - `apps/extension/src/shared/blacklist-utils.test.ts` 明确断言空 id 会被转换为 `rule-1`。
- 为什么值得清理：
  - 项目还未上线，不需要为旧的无 id blacklist storage records 保留迁移要求。
  - 为畸形 storage 伪造看似稳定的 id，会让当前数据形状违规更难被发现。
- 建议清理：
  - 要求 blacklist storage entries 必须有非空 string `id` 和非空 string `value`，畸形条目直接丢弃，不再修复。
  - 删除保留旧形状 generated ids 的测试断言。

## 20. 从 `AppEventMap` 中移除未使用的 `mediaserver:*` 事件通道

- 证据：
  - `apps/desktop-app/src/main/appEventBus.ts` 在全局 event map 中声明了 `mediaserver:status`、`mediaserver:sessions`、`mediaserver:subtitles` 和 `mediaserver:playback`。
  - 搜索 `mediaserver:` 只找到这些声明；没有代码 emit 或 listen 这些 bus events。
  - 当前 Jellyfin/Emby 路径在 `apps/desktop-app/src/main/mediaServerController.ts` 中通过 `JellyfinembySubtitlesService.on("status" | "sessions" | "subtitles" | "playback", ...)` 接收 media-server 更新。
- 为什么值得清理：
  - 这些是未使用的通用 media-server event bus 过渡 hooks，并未成为实际路径。
  - 保留它们会让 event surface 看起来比实际更宽，并强化未使用的通用 media-server 抽象。
- 建议清理：
  - 删除 `appEventBus.ts` 中四个未使用的 `mediaserver:*` entries，以及相关 type aliases/imports。

## 21. 移除未使用的 connection client bus events

- 证据：
  - `apps/desktop-app/src/main/appEventBus.ts` 声明了带 raw `WebSocket` payload 的 `connection:client-connected` 和 `connection:client-disconnected`。
  - `apps/desktop-app/src/main/connectionManager.ts` 在 socket 连接和断开时 emit 这些事件。
  - 搜索这些 event names 没有发现 listeners，也没有 tests；连接计数 state 已经通过 `StateManager.updateConnectionCount()` 和 `state:connection-count` 单独处理。
- 为什么值得清理：
  - 这些事件是死的 side-effect hooks，并且让 `appEventBus.ts` 只为未使用 payload 导入 `WebSocket` 类型。
  - 它们让 bus 看起来暴露了 raw socket lifecycle hooks，但当前代码只消费聚合连接状态。
- 建议清理：
  - 删除这两个 event declarations 和 emits，并移除 `appEventBus.ts` 中随之无用的 `WebSocket` import。

## 22. 避免在 workspace scripts 中多次重建 `@immersive-subs/contracts`

- 证据：
  - 根 `package.json` 运行 `pnpm -r build` 和 `pnpm -r typecheck`，这已经包含 `packages/contracts`。
  - `apps/desktop-app/package.json` 的 `build` 和 `typecheck` 都以 `pnpm --filter @immersive-subs/contracts build` 开头。
  - `apps/extension/package.json` 的 `typecheck` 也以 `pnpm --filter @immersive-subs/contracts build` 开头，而 `build` 又调用该 `typecheck`。
- 为什么值得清理：
  - 根递归 build/typecheck 可以按 workspace 依赖构建一次 contracts，随后 desktop 和 extension 又会重复调用同一个 build。
  - 这是围绕本地包的冗余编排，而该包已经属于 workspace graph。
- 建议清理：
  - 明确一个 contract-build owner：要么让 root recursive scripts 处理 workspace 顺序，要么保留 package-local prebuild 供单包命令使用，并让 root scripts 避免重复构建 contracts。

## 23. 移除未使用的 renderer error-bus 订阅层

- 证据：
  - `apps/desktop-app/src/renderer/utils/errorBus.ts` 维护了 `listeners` set，并导出 `onError(listener)`。
  - 搜索 `onError(` 和 `utils/errorBus` imports 显示 renderer actions/composables 只使用 `reportError()`。
  - 注释提到未来在 `App.vue` 中接 toast/banner subscriber，但实际没有实现。
- 为什么值得清理：
  - 这是围绕 renderer errors 的半成品 notification bus，没有活跃 consumer。
  - 它仅为未实现的 UI 路径增加了 listener failure handling 和状态。
- 建议清理：
  - 现阶段删除 `onError`、`listeners` 和 `ErrorListener`；如果确实需要用户可见错误报告，则实现真正的 error UI。

## 24. 修复或 type-check renderer tests 中过时的 type-only imports

- 证据：
  - `apps/desktop-app/src/renderer/stores/desktop.test.ts` 从 `../preload.cts` 导入 `AppSettings`、`DesktopState` 和 `RendererApi`。
  - 从该文件位置看，`../preload.cts` 会解析到 `src/renderer/` 下，但那里没有 preload 文件；真实 preload 文件是 `src/preload.cts`。
  - `apps/desktop-app/tsconfig.renderer.json` 排除了 `src/renderer/**/*.test.ts`，所以正常 renderer typecheck 不会检查这个 type-only import。
  - 临时 `tsc --noEmit` 单文件检查报告 `TS2307: Cannot find module '../preload.cts'`。
- 为什么值得清理：
  - 该测试目前依赖转译擦除错误 type import。
  - 这是过时测试 plumbing，可能隐藏 preload bridge 相关测试夹具类型的损坏。
- 建议清理：
  - 从 `main/types` 导入 `AppSettings` / `DesktopState`，从正确 preload 路径导入 `RendererApi`；或增加 test typecheck target 来捕获这类问题。

## 25. 从生产 TypeScript 输出中排除 desktop main tests

- 证据：
  - `apps/desktop-app/tsconfig.json` 包含 `src/main/**/*`，但没有排除 `src/main/**/*.test.ts`。
  - `apps/desktop-app/package.json` 用该 config 执行 `build:main`。
  - 临时运行 `tsc --project tsconfig.json --listEmittedFiles --outDir /tmp/usp-desktop-main-build-check` 输出了大量 `main/**/*.test.js` 文件和 `main/test/setup.js`。
  - 现有 ignored `apps/desktop-app/dist/main/` 目录中也包含先前构建生成的 `*.test.js` 文件。
- 为什么值得清理：
  - 测试代码在 Electron Forge 打包前被编译进生产 main-process 输出。
  - 这是过时 build plumbing，并增加了运行时永远不用的 packaged surface。
- 建议清理：
  - 增加一个 production main tsconfig，排除 `src/main/**/*.test.ts` 和 `src/main/test/**`；或直接调整现有 main tsconfig 的 exclude 列表。
  - 如果 main tests 需要 TypeScript 校验，保留单独的 test typecheck/build 路径。

## 26. 去重网络设置相等性检查

- 证据：
  - `apps/desktop-app/src/main/window/windowController.ts` 定义了 `areNetworkSettingsEqual()`，比较 auth token、endpoint 数量、endpoint id 和 `networkEndpointKey()`。
  - `apps/desktop-app/src/main/connectionManager.ts` 定义了相同比较逻辑的 `isSameNetwork()`。
  - 两个函数都用于判断是否需要重新应用网络 listeners。
- 为什么值得清理：
  - 这是共享 network-settings invariant 的重复业务逻辑。
  - 如果 endpoint identity 规则改变，两份实现必须保持同步。
- 建议清理：
  - 将 equality helper 移到 network endpoint utilities 附近，或放入一个小的 main/common network 模块，然后两个调用点共同使用。

## 27. 合并 clone scan 发现的重复测试 setup 块

- 证据：
  - 使用 `jscpd --min-lines 12 --min-tokens 80` 扫描发现 11 个 TypeScript clones，全部位于测试中。
  - 已确认的例子包括 `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts` 中重复的 geometry mock/setup 块。
  - `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.test.ts` 重复了几乎相同的 window size、API setup、mount、payload、pointer-drag 和 cleanup 块。
  - `apps/desktop-app/src/main/jellyfinemby/JellyfinembyConnection.test.ts` 在多个 case 中重复了 deferred subtitle fetch setup 和私有 `processSessions` binding。
- 为什么值得清理：
  - 这些不是独立行为检查，而是相邻场景周围重复的 fixture。
  - 重复会让测试变更噪声变大，并鼓励行为演进时继续复制粘贴 patch。
- 建议清理：
  - 为 geometry mocks、word-lookup window drag setup、Jellyfin/Emby subtitle-fetch session setup 抽取聚焦 helper。
  - 保留每个测试的行为专属断言，但删除重复 fixture boilerplate。
