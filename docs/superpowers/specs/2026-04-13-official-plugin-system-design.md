# Official Plugin System Design

> Note on current code: the repository currently implements a narrower bundled first-party plugin host. Downloadable plugin packages, package installation, and standalone renderer/main plugin artifacts are not implemented yet.

## Goal

将当前 desktop app 演进为“官方按需下载功能包”架构，让语音转录、句内高亮、词典、AI 总结等能力以独立插件包形式发布、安装、启用和更新，同时保持宿主对窗口、状态、设置框架和主界面结构的控制权。

本次设计必须满足以下结果：

- 插件系统的产品定位是“官方受控功能包”，不是第三方开放生态
- 插件按完整功能域划分，而不是按底层技术点细拆
- 插件在主仓库内开发，发布时产出独立插件包
- desktop app 运行时可安装、启用、禁用和更新插件
- 插件安装后默认不启用，用户完成配置后再手动开启
- 插件默认只提供设置页；只有必要时才允许声明主界面入口
- 宿主通过受控 surface 挂载插件 UI，不允许插件接管页面骨架
- 插件允许携带代码与资源包，例如词典数据、模板、规则文件、模型元数据
- 第一版不把“插件自带独立可执行程序”定义为标准能力
- 启动、安装和运行阶段都具备插件级错误隔离，单个插件异常不能拖垮主程序
- 首个样板插件应为语音转录插件

## Non-Goals

本次设计不包含：

- 为第三方开发者设计稳定开放 API 或 SDK
- 让插件自由定义路由、窗口、根组件或任意 UI 布局
- 把窗口管理、扩展连接、播放同步、基础字幕显示等宿主骨架能力插件化
- 一开始就引入沙箱执行、独立子进程隔离或远程插件市场后台
- 为尚未上线的产品构建复杂的向后兼容层
- 解决所有未来资源分发问题，例如大模型分片、增量更新、断点续传平台化
- 第一版支持插件自带原生二进制或任意本地可执行程序

## Product Decision

采用“官方受控插件包系统”。

这个决定的含义是：

- 插件仍由当前主仓库维护，不对外开放开发者生态
- 用户通过应用内固定的插件列表按需安装功能
- 插件是独立包而不是简单开关，因此将来可以自然升级到真正的应用内商店
- 宿主保留所有关键控制权，只允许插件通过受控声明方式接入

不采用以下方向：

- 先把所有功能内置到主程序，只做开关和资源补装
- 直接做成完整动态插件平台，允许插件任意扩展宿主
- 以“用户手动导入外部插件包”为第一主路径

原因：

- 只做开关会让第一版缺少真实插件边界，未来升级成本高
- 完整平台明显超出当前单人开发和未上线产品的现实需求
- 手动导入降低用户体验，也不能减少兼容和校验复杂度

## Plugin Scope

### Domain-Oriented Plugin Units

插件按完整功能域划分，而不是按底层实现拆分。

第一批候选插件为：

- `official.transcription`
- `official.dictionary`
- `official.ai-summary`
- `official.sentence-highlight`

这种粒度的优点是：

- 用户容易理解“安装了什么能力”
- 设置入口自然对应业务语义
- 插件状态、权限和资源都更容易管理
- 避免把一个功能拆成多个技术插件后产生编排和依赖复杂度

不采用以下粒度：

- 一个模型提供方一个插件
- 一个算法模块一个插件
- 一个小 UI 增强一个插件

### UI Boundary

插件默认只提供两类 UI 贡献：

- 一块设置页或设置分组
- 一个可选主界面入口声明

主界面入口只有在用户确实需要直接与插件能力交互时才开放，例如：

- 字幕选中文本后的上下文工具
- 右侧卡片或抽屉入口
- 某个受控操作按钮

插件不允许：

- 定义自己的路由系统
- 替换根组件
- 自己创建独立窗口作为标准交互路径
- 任意修改现有 Vue 组件树

原因：

- 当前项目的主界面结构仍在快速演进，插件不应反向绑死宿主
- 对单人开发项目来说，UI 自由度越大，后续维护成本越高
- “官方功能包”需要统一的产品语言，而不是一组拼贴式小应用

## Repository Architecture

### Source Layout

插件源码放在主仓库内，建议采用独立 workspace package 组织：

```text
packages/
  plugins/
    transcription/
    dictionary/
    ai-summary/
    sentence-highlight/
```

每个插件包都参与 monorepo 构建、测试和类型检查，但最终发布时产出独立插件包。

原因：

- 复用现有 monorepo 基础设施，不引入额外仓库管理复杂度
- 插件与宿主可以共享类型和少量稳定内部包
- 当前只有单一开发者，这种结构开发效率最高

### Package Output

每个插件发布产物至少包含：

- `manifest.json`
- 主进程入口产物
- 渲染层入口产物
- 资源目录或资源清单

第一版不要求插件包格式面向第三方工具链完全开放，但必须满足：

- 能被宿主校验版本和兼容性
- 能被安装器解压和登记
- 能在运行时按插件粒度加载和卸载

## Plugin Package Structure

### Manifest

每个插件必须包含 manifest，作为安装、兼容性校验和运行时接入的唯一事实来源。

manifest 至少包含以下字段：

- `id`
  - 例如 `official.transcription`
- `version`
  - 插件自身版本
- `displayName`
  - 用户可见名称
- `description`
  - 插件说明
- `hostVersionRange`
  - 声明兼容的宿主版本范围
- `features`
  - 插件提供的能力集合
- `settings`
  - 设置页声明
- `surfaces`
  - 主界面挂载点声明
- `resources`
  - 资源包清单

建议预留但第一版尽量少用的字段：

- `dependencies`
- `platforms`
- `minimumAppCapabilities`

设计原则：

- manifest 要稳定，但不追求对外通用
- 第一版所有插件都使用官方命名空间，避免后续命名混乱
- 宿主只基于 manifest 做决定，不依赖插件包内部目录细节

### Main And Renderer Entrypoints

每个插件导出两类标准入口：

- `registerMain(context)`
- `registerRenderer(context)`

其职责分别为：

- `registerMain(context)`
  - 注册主进程能力、任务执行器、资源检查、后台逻辑
- `registerRenderer(context)`
  - 注册设置页、主界面入口声明和渲染层展示逻辑

插件不直接操作宿主内部单例，而是通过宿主传入的 `context` 工作。

### Resources

第一版插件允许携带以下资源：

- 词典数据
- prompt 模板
- 规则文件
- 默认配置
- 模型元数据
- UI 文案或离线数据表

第一版不把以下内容定义为标准支持范围：

- 插件自带任意本地可执行程序
- 原生动态库
- 需要复杂安装器协作的系统级依赖

这样做的原因是：

- 当前真正需要的插件多半以“代码 + 资源”即可成立
- 资源系统比二进制分发更容易控制、更新和恢复
- 可以为未来扩展预留目录与 manifest 字段，而不必在第一版实现全部能力

## Installation Model

### Official Catalog

宿主内置一个官方插件目录清单，作为应用内“插件”页面的数据来源。

该目录清单至少描述：

- 可安装插件列表
- 每个插件的最新版本
- 下载地址
- 校验值
- 简要说明
- 资源包信息

第一版可以使用静态 JSON 或受控远程清单，不要求一开始就建设后台管理系统。

### Local Storage Layout

插件安装到用户数据目录，而不是应用安装目录。建议结构为：

```text
plugins/
  registry.json
  packages/
    <plugin-id>/
      <version>/
        manifest.json
        main/
        renderer/
  resources/
    <plugin-id>/
  cache/
```

职责如下：

- `registry.json`
  - 记录安装状态、启用状态、当前版本、资源版本、错误状态
- `packages/`
  - 存放插件代码包
- `resources/`
  - 存放插件资源
- `cache/`
  - 存放下载中间产物和临时解压目录

这种分离允许：

- 代码包升级时不重复下载大资源
- 失败安装不污染运行态目录
- 未来保留回滚和修复能力

### Install And Enable Lifecycle

第一版插件生命周期定义为：

1. 用户在插件页点击安装
2. 宿主下载插件包与资源包
3. 校验签名或哈希
4. 解压到用户目录
5. 写入 `registry.json`
6. 插件状态进入 `installed-disabled`
7. 用户进入设置页完成配置
8. 用户手动启用插件
9. 启用时再次检查兼容性、资源和配置完整性
10. 通过检查后进入 `enabled`

安装后默认不启用，这是本次设计的强约束。

原因：

- 语音转录、AI 总结等能力常常依赖额外配置
- 自动启用容易让插件在未准备好时占资源或报错
- “安装”和“启用”分离，更符合按需功能包的产品心智

## Host Loading Model

### Startup Flow

宿主启动时采用严格但简单的三阶段流程：

1. 读取插件 registry
2. 校验已安装插件的 manifest、宿主兼容性和资源完整性
3. 加载启用插件的主进程贡献与渲染层贡献

启动阶段不要求联网，也不在启动时主动检查更新。

### Contribution-Based Integration

插件不能直接改写宿主，而是向宿主声明贡献，由宿主执行挂载。

允许的贡献类型包括：

- 设置页 section
- 受控主界面入口
- 上下文工具动作
- 后台任务能力
- 状态面板卡片

不允许的贡献方式包括：

- 直接访问宿主根组件并插入任意节点
- 自己维护一套平行的全局状态结构并强行绑定到宿主 UI
- 覆盖宿主现有行为而不经过声明

这种模式的核心原则是：

- 插件拥有“能力”
- 宿主拥有“调度权”和“显示权”

## Runtime Boundary

### Main Process

第一版主进程插件运行在 Electron 主进程内，不单独起插件子进程。

原因：

- 当前许多可插件化能力本来就位于主进程，例如转录、资源管理、IPC handler
- 受控模块加载更容易落地
- 在未上线、单人维护阶段，引入独立进程会过早增加复杂度

### Renderer

渲染层插件只能通过已定义 surface 与宿主交互，不能接管整体页面结构。

建议第一版先开放有限 surface：

- `settings.section`
- `subtitle.context-tools`
- `right-panel.card`

只开放少量 surface 的原因是：

- 便于统一视觉和交互
- 出问题时更容易排查
- 有利于后续逐步扩展，而不是一开始就背上无限兼容面

## Data Model

### Configuration

插件配置统一存放在宿主 settings 中，但使用插件命名空间隔离，例如：

```text
settings.plugins[pluginId]
```

这样做的好处是：

- 继续复用当前统一的设置存储、IPC 更新和持久化链路
- 插件配置与宿主全局配置可以统一备份和迁移
- 不需要为每个插件建立独立配置系统

### Runtime State

插件运行结果不直接写进任意全局对象，而是通过宿主定义的状态通道暴露。

例如：

- 转录插件产出字幕轨或转录任务状态
- 词典插件产出查词结果面板数据
- AI 总结插件产出视频总结卡片数据

宿主负责决定这些结果如何进入 renderer store 和 UI。

### Resource State

资源安装、损坏修复、版本差异由插件资源管理器维护，不与普通业务逻辑混写。

原因：

- “资源是否完备”是生命周期问题，不是普通功能调用细节
- 资源错误与运行错误需要不同恢复路径

## Error Isolation

第一版至少需要以下四层隔离：

- 加载失败隔离
  - manifest 错误、入口缺失、宿主版本不兼容时跳过该插件
- 运行失败隔离
  - 插件任务执行失败只影响该插件当前操作
- UI 挂载失败隔离
  - 单个插件设置页或卡片渲染出错时显示错误占位，不影响整个窗口
- 资源错误隔离
  - 资源缺失或校验失败时把插件标记为需修复，而不是在实际使用时才崩溃

建议统一插件状态语义：

- `not-installed`
- `installed-disabled`
- `enabled`
- `broken`
- `needs-attention`
- `updating`

这组状态用于：

- 插件页状态展示
- 启用/禁用按钮可用性判断
- 错误提示和修复入口
- 遥测与日志分类

## Settings Integration

当前设置系统已存在固定 section 列表，因此插件化不应推翻宿主设置框架，而应在其上扩展。

建议策略为：

- 继续保留内建 section
- 新增固定的 `plugins` 顶层区域
- 已安装插件在该区域展示安装状态、启用状态、更新状态和错误状态
- 已启用插件可以额外注册自己的设置 section

迁移方向应当是：

- 宿主固定 section 负责全局骨架
- 插件 section 负责自身配置

其中，现有 `transcription` 设置区是最自然的首个插件化目标。

## Migration Strategy

### Phase 1: Host Foundations

先建立宿主基础设施：

- 插件 registry
- 插件 catalog
- manifest 解析器
- 安装器与资源目录管理
- 启用/禁用状态管理
- 设置页插件挂载机制
- renderer 侧受控 surface 注册机制

这一步的目标是先形成真实宿主层，而不是把旧模块换个目录继续耦合。

### Phase 2: First Sample Plugin

首个样板插件选择语音转录插件。

原因：

- 当前已有相对清晰的主进程边界，例如 `transcriptionService.ts`、相关 IPC handler 和设置区
- 它天然属于可选能力，不是所有用户都需要
- 它已经拥有独立设置语义，最适合作为插件设置页样板
- 它未来最可能需要更重资源，是验证插件资源模型的好案例

### Phase 3: Subsequent Plugins

推荐后续顺序：

1. `official.transcription`
2. `official.dictionary`
3. `official.ai-summary`
4. `official.sentence-highlight`

原因：

- 词典插件可以验证“设置页 + 文本交互入口 + 资源包”
- AI 总结插件可以验证“后台任务 + 结果面板 + prompt 资源”
- 句内高亮更贴近渲染内核，适合在宿主 surface 稳定后再接入

## Host-Owned Capabilities

以下能力应继续由宿主内建，不纳入插件边界：

- 窗口管理
- 托盘、快捷键和显示器相关控制
- 浏览器扩展连接与桌面连接管理
- 基础播放状态同步
- 基础字幕显示与主阅读面板骨架
- 全局设置系统
- profile 与 URL rule 体系

原则是：

- 宿主负责产品骨架
- 插件负责学习增强能力和附加能力

## Testing And Verification Strategy

插件系统的验证至少覆盖：

- manifest 解析和兼容性判断
- 安装器成功路径与失败回滚
- registry 状态迁移
- 启用/禁用流程
- 插件设置页挂载
- 插件 surface 挂载失败隔离
- 首个样板插件的端到端接入

第一版不要求完整构建插件市场测试矩阵，但必须确保：

- 没有安装任何插件时，宿主行为不退化
- 单个插件损坏时，宿主可继续启动和使用
- 已安装但未启用插件不会误占运行时资源

## Open Decisions Resolved By This Spec

本 spec 明确固定以下决策：

- 第一版采用“官方受控插件包系统”
- 插件按完整功能域划分
- 插件默认只有设置页，必要时才允许主界面入口
- 安装后默认不启用
- 第一版允许“代码 + 资源”，不标准化支持插件自带可执行程序
- 插件在主仓库内开发，发布为独立包，运行时安装加载
- 首个样板插件为语音转录插件

## Summary

本次设计将 desktop app 的插件系统定义为一种受控、面向用户的官方功能包架构，而不是开放平台。宿主继续掌握窗口、状态、设置和主界面骨架，插件只在受控边界内贡献能力、资源和设置页。实现路径以“先搭宿主基础设施，再迁移语音转录插件”为中心，既能满足当前单人开发和未上线产品的现实约束，也为未来升级到应用内插件商店保留清晰演进空间。
