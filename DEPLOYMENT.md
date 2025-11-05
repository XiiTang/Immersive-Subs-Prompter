# 部署与分发指南

本文档覆盖三部分：浏览器插件打包、Electron 桌面端安装包制作、`yt-dlp` 的跨平台分发策略。

## 1. 浏览器插件

### 1.1 构建 / 打包

插件基于 Manifest V3，无额外打包步骤，可直接压缩源码：

```bash
cd extension
zip -r ../universal-subtitle-messenger.zip .
```

生成的 `universal-subtitle-messenger.zip` 可用于 Chrome Web Store / Edge Add-ons 提交。提交前请确认：

- `manifest.json` 中的 `name`、`description`、`version`、`icons` 等信息符合发布要求；
- 所需域名已列入 `host_permissions`；
- 如需国际化，可补充 `_locales` 目录（MV3 要求）。

### 1.2 内部分发

如只在公司内部使用，可直接共享 `extension/` 目录，让用户手动在 `chrome://extensions` 中「加载已解压的扩展程序」。亦可在企业管理平台中配置 CRX 自动分发。

## 2. Electron 桌面应用

### 2.1 纯构建（开发 / 内测）

```bash
cd desktop-app
npm install
npm run build   # 输出 dist/
electron .
```

`dist/` 目录包含编译后的主进程、预加载脚本与渲染进程静态资源，可直接随源码运行。

### 2.2 正式安装包（推荐 electron-builder）

项目已内置 `electron-builder` 配置与脚本，可直接运行：

```bash
cd desktop-app
npm install
npm run dist:win    # 或 dist:mac / dist:linux / dist:all
```

构建流程会先执行 `npm run build`，随后将 `dist/` 内容打进安装包（输出到 `desktop-app/release/`）。如需自定义图标、签名、Bundle Identifier，可修改 `package.json` 中的 `build` 字段。

> 若更偏好 `electron-packager` 亦可替换，核心步骤一致：先 `npm run build`，再将 `dist/` 与 `node_modules` 打进特定平台目录。

### 2.3 代码签名（可选）

- macOS：需使用 Apple Developer ID，对 `.app` 进行 `codesign` 与 `notarize`。
- Windows：建议使用 EV/OV 证书对 `.exe` / `.msi` 签名，以避免 SmartScreen 警告。
- Linux：通常无需签名，可提供 SHA256 校验。

## 3. `yt-dlp` 的随包策略

桌面端现在自带自动下载机制：当字幕服务首次运行时，会检测用户数据目录下的 `yt-dlp/<platform>` 是否存在可执行文件；若无，则从 GitHub Release 拉取对应平台最新版本并缓存。下载失败会在 UI 中体现错误消息。

若需要离线安装或内网环境，可将官方二进制预先放入 `desktop-app/resources/yt-dlp/`，electron-builder 会在打包时将其复制进应用资源目录，运行时也会优先检测该目录中的文件。

## 4. 发布前检查清单

| 项 | 检查内容 |
| --- | --- |
| 通讯端口 | 插件与桌面端 `WS_ENDPOINT` / `USP_WS_PORT` 是否一致、是否暴露在受信任网络内 |
| 平台测试 | Windows / macOS / Linux 各跑一遍，验证字幕下载、轨道切换、控制命令是否无误 |
| 权限提示 | 插件 `host_permissions` 与后台脚本是否最小化，必要时补充隐私说明 |
| 字幕缓存 | Electron 端的临时字幕目录已在下载结束后删除，避免残留 |
| `yt-dlp` 版本 | 若随包分发，确认版本与许可证（Unlicense/MIT）信息；必要时在 About 页面展示 |

完成上述步骤后，即可将：① 插件 ZIP、② 各平台桌面安装包、③ 对应发行说明一并发布给用户。***
