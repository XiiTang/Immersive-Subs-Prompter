# Universal Subtitle Plugin

一个由浏览器插件与 Electron 桌面端组成的「字幕信使」系统。插件驻留在 YouTube / Bilibili / 抖音等站点，实时采集视频播放信息并经 WebSocket 推送给本地桌面应用；桌面端负责拉取字幕（通过 `yt-dlp`），展示滚动字幕面板，并支持在字幕列表内跳转或控制浏览器播放器。

## 目录结构

```
extension/     # Chromium MV3 插件源码，负责浏览器端注入与通信
desktop-app/   # Electron + TypeScript 桌面应用
```

## 快速开始

### 前置依赖

- Node.js 18+ 与 npm
- Chrome / Edge / 基于 Chromium 的浏览器用于加载扩展
- 桌面端首次运行会自动从 GitHub 下载对应平台的 `yt-dlp`，并在后续启动时对比最新 Release 自动更新；如无法联网，可按部署指南预置二进制

### 启动桌面端

```bash
cd desktop-app
npm install
npm run start   # 构建 TypeScript 并启动 Electron
```

应用会在本地监听 `ws://127.0.0.1:44501`，等待插件连接。

### 加载浏览器插件

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 选择「加载已解压的扩展程序」，指向仓库下的 `extension/` 目录

随后在 Bilibili / YouTube / 抖音播放任意视频，即可看到桌面端窗口下载字幕并联动高亮。

## 功能概览

- **实时播放信息**：content script 监听 `<video>` 的时间轴 / 倍速 / URL，并以 300ms 心跳推送给桌面端。
- **字幕聚合**：Electron 端通过 `yt-dlp` 一次性下载所有可用字幕轨道（含自动字幕），解析为统一的 VTT cue 列表。
- **轨道切换**：UI 提供下拉选择不同语言/轨道，点击字幕行即可跳转对应时间点。
- **双向控制**：桌面端可发起播放 / 暂停 / 跳转命令，插件收到后直接操控视频元素。

## 开发脚本

| 位置 | 命令 | 说明 |
| ---- | ---- | ---- |
| `desktop-app` | `npm run start` | 构建 + 启动 Electron（watch-free） |
| `desktop-app` | `npm run build` | 仅构建 TypeScript 与静态资源到 `dist/` |
| `desktop-app` | `npm run dist:win/mac/linux` | 使用 electron-builder 产出对应平台安装包（Win 版安装向导可自由选择路径） |
| `desktop-app` | `npm run dist:all` | 同时打包 Win/Mac/Linux（需在各自平台执行） |

插件部分暂无打包脚本，直接使用源码目录即可。

## 部署与分发

详细流程（包括扩展打包、Electron 安装包、yt-dlp 随应用分发策略）请参考 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 疑难排查

- **桌面端提示 `未找到 yt-dlp`**：首次启动未能联网下载，或 GitHub 被阻断。可手动将二进制放入 `desktop-app/resources/yt-dlp/` 并重新打包，或在用户数据目录的 `yt-dlp` 子目录中放置可执行文件。
- **插件显示未连接**：确保 Electron 已启动且 WebSocket 监听端口未被占用；必要时在 `extension/background.js` 中修改 `WS_ENDPOINT` 与桌面端保持一致。
- **字幕缺失**：部分视频不提供字幕或 `yt-dlp` 无法获取。可查看桌面端控制台/终端日志了解 `yt-dlp` 输出。
- **Windows PowerShell 日志乱码**：
  - **原因**：Windows PowerShell 默认使用 GBK 编码，而应用日志使用 UTF-8 编码，导致中文字符显示为乱码。
  - **临时解决方案**：在运行应用前，在 PowerShell 中执行以下命令：
    ```powershell
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    ```
  - **永久解决方案**：编辑 PowerShell 配置文件，添加上述命令使其自动生效：
    1. 运行 `notepad $PROFILE` 打开配置文件（如不存在会自动创建）
    2. 添加上述三行命令
    3. 保存并重新打开 PowerShell
  - **推荐**：使用 Windows Terminal 或 VS Code 内置终端，它们默认支持 UTF-8 编码。

## 许可证

示例仅供内部集成参考，分发前请确认第三方依赖（尤其是 `yt-dlp`）的许可证要求。
