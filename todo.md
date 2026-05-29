# TODO

## 项目审查发现

> 记录时间：2026-05-29
> 范围：全项目静态审查；重点查找逻辑问题、过度设计、冗余补丁、不必要 fallback / try / 兜底、迁移层、兼容层和旧代码判断层。

### P1

- [ ] 修复 SettingsStore 写盘失败后的内存脏状态
  - 文件：`apps/desktop-app/src/main/settings/SettingsStore.ts`
  - 问题：`update()` 先修改 `this.data`，再执行 `save()`。如果写盘失败，IPC 会报错，但主进程内存已经变成未保存的新设置。
  - 建议：先生成 `next` 并成功写盘后再替换 `this.data`；或在 `save()` 失败时显式回滚。

- [ ] 修复 ytdlp 字幕缓存 key 未包含 profile / yt-dlp 参数的问题
  - 文件：
    - `apps/desktop-app/src/main/subtitleService.ts`
    - `apps/desktop-app/src/main/subtitleCacheManager.ts`
  - 问题：缓存只按 `url + source` 生成 key，但实际下载结果受当前 profile 的 `ytDlpArgs` 影响。切换字幕语言、cookies、格式等参数后，同 URL 仍会命中旧缓存。
  - 建议：把规范化后的 `ytDlpArgs` 或 profile 字幕配置签名纳入 ytdlp 缓存 key。

- [ ] 收敛 extension 离线 WebSocket 消息队列
  - 文件：`apps/extension/src/background/desktop/DesktopConnection.ts`
  - 问题：断线时 `pending` 队列无上限，所有消息都会累积并在重连后全量回放。`time-update` 等瞬时播放事件会变成过期事件，还可能造成内存增长。
  - 建议：丢弃瞬时事件，或只保留每个 tab/type 的最新状态；同时设置队列上限，不回放 stale playback events。

### P2

- [ ] 校验 network endpoint id 唯一性
  - 文件：
    - `apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.ts`
    - `apps/desktop-app/src/main/connectionManager.ts`
  - 问题：sanitizer 只按 `host:port` 去重，不保证 endpoint `id` 唯一；但 connection manager 用 `id` 作为 listener map key。重复 id 会导致监听器互相覆盖。
  - 建议：项目未上线，直接拒绝重复 id；不需要做历史数据兼容或迁移。

- [ ] 移除 media server session 跨服务器 fallback
  - 文件：`apps/desktop-app/src/main/mediaServer/MediaServerSessionHandler.ts`
  - 问题：当前逻辑会仅凭 `nowPlayingItemId` 跨服务器匹配 session。多服务器场景下 item id 不保证全局唯一，可能绑定到错误服务器的播放会话。
  - 建议：已知 server 时必须按 server 匹配；未知 server 时不要跨服务器自动选择 session。

### P3

- [ ] 删除危险且过时的 node_modules 清理脚本
  - 文件：
    - `apps/desktop-app/scripts/cleanup-node-modules.cjs`
    - `apps/desktop-app/package.json`
  - 问题：脚本注释称打包前运行，但实际 package/make 未调用；脚本会删除 `node_modules` 内 `.d.ts`、`.map`、测试、文档等文件，容易破坏后续 typecheck/build。
  - 建议：删除脚本和 `clean:node-modules` npm script；不要保留手工打包补丁。

- [ ] 删除 extension Logger 中未使用的 facade 方法
  - 文件：`apps/extension/src/shared/Logger.ts`
  - 问题：`videoDetected`、`videoActivated`、`messageSent`、`desktopConnected`、`portConnected` 等方法未被调用；部分 category 还不在 enabled list 中。
  - 建议：删除未使用 facade，只保留实际使用的 `debug/info/warn/error`，或统一 category 后再按需恢复调用。

- [ ] 删除 monorepo 迁移守卫测试
  - 文件：`apps/desktop-app/src/renderer/monorepoWorkspace.test.ts`
  - 问题：测试主要断言旧目录不存在、README 包含命令、workspace 脚本存在，属于迁移完成后的结构守卫，不验证产品行为。
  - 建议：删除该测试；如确有必要，只把最小构建校验留在 CI 脚本中。
