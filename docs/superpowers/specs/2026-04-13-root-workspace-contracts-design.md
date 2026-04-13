# Root Workspace And Shared Contracts Design

## Goal

将当前仓库重组为一个根级 `pnpm workspace` monorepo，并建立单一的 `packages/contracts` 共享协议包，作为 desktop app 与 browser extension 之间跨端通信契约的唯一来源。

本次设计必须满足以下结果：

- 仓库使用根级 `pnpm workspace` 作为唯一包管理形态
- 全仓库只有一份根级锁文件，不再保留子项目各自的 lockfile
- 可运行应用目录统一为 `apps/desktop-app` 与 `apps/extension`
- 共享包目录固定为 `packages/contracts`
- `packages/contracts` 只承载跨端通信契约，不承载应用私有状态
- desktop app 与 extension 的跨端消息、命令、共享 payload 全部从 `@immersive-subs/contracts` 导入
- 根级提供统一的 `build`、`test`、`typecheck` 工作流入口
- contracts 包具备稳定公开导出面，app 侧不允许深链导入内部文件

## Non-Goals

本次设计不包含：

- 兼容当前双包独立维护方式
- 保留 npm 与 pnpm 混用的仓库形态
- 迁移或兼容旧数据、旧协议、旧目录结构
- 为未上线产品设计向后兼容层
- 将 desktop app 或 extension 的内部状态模型整体抽到 shared
- 顺手引入 turbo、nx、runtime schema 校验平台等额外基础设施
- 抽象一个“万能 shared types” 仓库承载所有类型

## Current Problems

当前仓库虽然已经包含 desktop app 与 extension 两个 TypeScript 项目，但结构仍然是两个彼此并列、各自独立安装依赖的应用目录，带来几个明确问题：

- `desktop-app` 与 `extension` 各自维护自己的 `package.json`、lockfile 与局部工作流，仓库没有统一安装、构建和测试入口
- 仓库根目录没有 workspace 边界，难以自然引入可复用共享包
- 跨端通信相关类型已经出现重复定义，例如 loop、playback、message envelope 等协议对象在两个应用中分别维护
- 这些重复定义已经存在细节漂移风险，例如字段是否可选、字段命名、时间单位、状态枚举范围并不天然受同一来源约束
- app 内部状态与跨端传输对象没有被清晰区分，容易把“应用私有模型”和“通信协议模型”混在一起
- 现有目录命名没有显式表达“应用”和“共享包”的不同角色，长期扩展时边界会持续变糊

## Product Decision

采用“根级 `pnpm workspace` + `apps/*` + `packages/contracts`”的最终形态。

具体含义是：

- 根目录作为 monorepo 工作区根，统一安装依赖、维护锁文件并暴露仓库级脚本
- 两个可运行目标统一放到 `apps/` 下：
  - `apps/desktop-app`
  - `apps/extension`
- 所有跨应用复用的包统一放到 `packages/` 下
- 本次只建立一个共享包：`packages/contracts`
- `packages/contracts` 只定义 desktop 与 extension 之间跨端通信协议，不吸收任一应用的内部 state、view model 或持久化 schema

不采用以下方向：

- 保持当前根目录平铺两个应用，只补一个 shared 目录
- 继续用 npm workspaces
- 在当前规模下直接引入 turbo
- 把“所有看起来可能复用的类型”都统一搬进 shared

原因：

- `pnpm workspace` 是当前目标下最自然的 monorepo 形态，依赖管理、跨包引用和根级脚本都更清晰
- `apps/*` 与 `packages/*` 的目录语义稳定，能直接表达运行单元与复用单元的边界
- 只建立 `contracts` 包可以精确解决当前最真实的问题，即跨端协议重复定义与漂移
- 不引入额外编排层，避免基础设施复杂度先于实际规模增长

## Repository Architecture

### Top-Level Layout

仓库最终结构定义为：

```text
/
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  tsconfig.base.json
  apps/
    desktop-app/
    extension/
  packages/
    contracts/
  docs/
  assets/
```

该结构的含义是：

- 根目录只承载 monorepo 级配置、共享文档和仓库资产
- `apps/` 只放可运行应用
- `packages/` 只放可复用包

不再保留“两个应用直接散落在仓库根目录”的结构。

### Package Roles

三个 package 的职责必须明确：

- `@immersive-subs/desktop-app`
  - Electron desktop 应用
  - 负责窗口管理、字幕加载、渲染入口、IPC、媒体服务接入等桌面端能力
- `@immersive-subs/extension`
  - 浏览器扩展
  - 负责页面视频检测、播放状态采集、控制命令执行、后台连接与 popup 管理
- `@immersive-subs/contracts`
  - 跨端通信协议包
  - 负责定义 extension 与 desktop 之间共享的消息、命令与基础 DTO

### Dependency Direction

依赖方向必须保持单向：

- `@immersive-subs/desktop-app -> @immersive-subs/contracts`
- `@immersive-subs/extension -> @immersive-subs/contracts`
- `@immersive-subs/contracts` 不依赖任一 app

这意味着 `contracts` 不允许导入 Electron、Vue、Chrome extension API 或任一 app 内部模块。

## Contracts Boundary

### What Lives In `packages/contracts`

`packages/contracts` 只收纳“跨端传输时必须由双方共同理解”的协议对象，包括：

- extension 发给 desktop 的消息联合类型
- desktop 发给 extension 的命令联合类型
- 这些消息与命令所依赖的共享 payload
- 协议层使用的共享枚举、字面量联合和 DTO
- 面向传输的数据快照对象，例如 loop、playback、video state 的协议表示

### What Must Stay In Apps

以下对象必须保留在各自应用内部，不进入 `packages/contracts`：

- Electron 主进程内部状态
- Vue renderer 的 view model、UI state、store 内部派生字段
- extension content script / background script 的 runtime state
- settings store、profile 配置、transcription 配置、media server 业务模型
- subtitle 下载、解析、缓存、窗口管理等应用实现细节

### Boundary Rule

是否应该进入 `packages/contracts` 的判断标准只有一个：

如果对象需要被两个应用通过边界传输并由双方共同解释，它属于 contracts；如果它只是某一应用的内部实现状态，它不属于 contracts。

本次设计明确拒绝把 `contracts` 扩张为“shared types 杂货铺”。

## Contracts Package Structure

### Internal Layout

`packages/contracts` 采用按通信方向分层的结构：

```text
packages/contracts/
  package.json
  tsconfig.json
  src/
    core/
      loop.ts
      playback.ts
      video.ts
      transport.ts
    messages/
      from-extension.ts
      to-extension.ts
    index.ts
```

职责如下：

- `core/*`
  - 定义与具体消息 envelope 解耦的基础协议 DTO
  - 例如 loop、playback、video state 等共享传输对象
- `messages/from-extension.ts`
  - 定义 extension 发给 desktop 的消息类型
- `messages/to-extension.ts`
  - 定义 desktop 发给 extension 的命令类型
- `index.ts`
  - 作为包的唯一稳定公开导出面

### Export Surface

app 侧只允许从包公开入口导入：

```ts
import type { FromExtensionMessage, ToExtensionMessage } from "@immersive-subs/contracts";
```

不允许使用深链导入，例如：

```ts
import type { LoopSessionDto } from "@immersive-subs/contracts/src/core/loop";
```

原因：

- 公开导出面是 contracts 包的稳定边界
- 深链导入会让内部重构变成破坏性变更
- app 无需理解 contracts 内部文件布局

### Naming Rules

contracts 包内的类型命名统一采用协议语义命名，优先使用：

- `Message`
- `Command`
- `Payload`
- `Snapshot`
- `Dto`

避免复用 app 内部同名 state 对象，防止“协议对象”和“运行时状态对象”语义混淆。

## Package Management And Build Workflow

### Workspace Standard

仓库使用根级 `pnpm workspace` 作为唯一安装与依赖解析机制：

- 根目录存在唯一 `pnpm-workspace.yaml`
- 根目录存在唯一 `pnpm-lock.yaml`
- 所有安装、更新和依赖同步都从根目录发起

子项目不再保留自己的 lockfile，也不再作为独立包管理岛存在。

### Root Scripts

根级 `package.json` 提供统一仓库工作流入口。标准脚本集合定义为：

- `build`
- `test`
- `typecheck`
- `build:desktop`
- `build:extension`
- `test:desktop`
- `test:extension`

这些脚本负责调用 workspace filter，统一组织各 package 的执行，而不是把仓库级入口继续散落在子目录说明文档里。

### App Build Ownership

虽然仓库在根级统一，但每个 app 仍保留自己的构建职责：

- `apps/desktop-app`
  - 继续持有 Electron Forge、Vite、Vue renderer、main/preload 的构建配置
- `apps/extension`
  - 继续持有 esbuild、manifest 目标和扩展打包配置
- `packages/contracts`
  - 负责独立编译自己的 TypeScript 输出与类型定义

不把三个 package 的构建行为强行合并成一套通用流水线。

## TypeScript Architecture

### Base Config

根目录提供一个 `tsconfig.base.json` 作为公共 TypeScript 基础配置，承载：

- 公共严格模式约束
- 公共模块解析规则
- 共享语言级编译约束

各 package 在自己的 `tsconfig` 中通过 `extends` 继承该基础配置，并保留对自身构建目标的控制权。

### Contracts Consumption

两个 app 必须通过 package import 使用 contracts：

```ts
import type { VideoStateSnapshot, ExtensionToDesktopMessage } from "@immersive-subs/contracts";
```

不允许复制一份本地镜像类型，也不允许通过路径别名绕开 package 边界直接引用 contracts 源码文件。

### Compile Target Principle

`packages/contracts` 作为可消费包，需要产出对 workspace 其他包稳定可见的类型输出；desktop 与 extension 只消费它的 package 产物与声明，不自行承担“帮 contracts 编译源码副本”的责任。

## Message Model

### Directional Message Unions

跨端协议以方向为核心组织：

- `FromExtensionMessage`
  - extension -> desktop
- `ToExtensionMessage`
  - desktop -> extension

这两个联合类型分别作为跨端收发的顶层入口。

### Discriminated Union Requirement

所有跨端消息必须使用判别联合建模：

- 每个消息拥有稳定的 `type` 字段
- `type` 必须是字面量
- payload 结构必须与 `type` 一一对应

不允许使用松散对象或 ad-hoc 条件字段表达多种消息形态。

### DTO-Only Transport

跨端边界上传输的对象必须是序列化友好的 DTO：

- 不包含函数
- 不包含类实例语义
- 不包含 DOM、Electron、Chrome API 句柄
- 不包含 timeout handle、WeakMap、WeakSet 等运行时引用对象

这条规则会把“协议表示”与“应用内部运行时状态”彻底分开。

## Validation Strategy

### Primary Guardrail

本次设计采用“编译期强约束 + 关键协议测试”的治理方式。

核心手段是：

- TypeScript 判别联合约束
- `@immersive-subs/contracts` 作为唯一协议源
- app 通过 package import 编译消费 contracts

### Runtime Validation

本次不默认引入 zod、valibot 或其他 runtime schema 校验库。

原因：

- 当前最主要的问题是协议定义重复与边界不清，不是外部不受控输入导致的运行时解码风险
- 在当前规模下，先统一协议源能更直接解决问题
- runtime schema 会引入额外抽象和维护面，不应先于实际需求出现

如果未来出现第三方客户端、外部插件或明确的协议版本协商需求，再单独设计 runtime schema 层。

## Testing Strategy

### Contracts Package Tests

`packages/contracts` 需要具备自己的协议级测试，重点覆盖：

- 公开导出是否完整
- 关键消息样例是否满足类型预期
- 共享 DTO 是否保持序列化友好

contracts 包的测试目标是守住协议边界，而不是承载业务逻辑测试。

### App Consumer Tests

desktop 与 extension 各自保留自己的消费侧测试：

- desktop 侧验证接收 extension 消息后的适配与分发逻辑
- desktop 侧验证发往 extension 的 command 构造逻辑
- extension 侧验证发消息时的 envelope 结构
- extension 侧验证接收 command 时的类型分发逻辑

这些测试继续属于 app 自己，不迁入 contracts 包。

### Repository Verification Entry

仓库的标准验证入口定义为：

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

这三条命令共同构成 monorepo 级别的完成验证面。

## Completion Criteria

当且仅当以下条件同时成立时，本设计视为完成：

- 仓库已经是根级 `pnpm workspace`
- 根目录存在唯一 `pnpm-lock.yaml`
- 目录结构已经收敛为 `apps/desktop-app`、`apps/extension`、`packages/contracts`
- desktop 与 extension 对跨端协议的消费全部来自 `@immersive-subs/contracts`
- app 内部重复定义的跨端协议类型已被移除
- contracts 包的公开导出面已建立，并成为唯一导入入口
- 根级 `build`、`test`、`typecheck` 工作流已建立
- `packages/contracts` 未承载 app 私有状态或与跨端传输无关的业务模型

## Open Questions Resolved By This Design

本次设计已经明确做出的关键取舍如下：

- workspace 工具选择：根级统一使用 `pnpm`
- 目录结构：使用 `apps/* + packages/*`
- shared 范围：只做跨端 `contracts`
- contracts 边界：只收通信契约，不收 app 私有模型
- 协议组织方式：按通信方向拆分
- 协议治理方式：以 TypeScript 强约束和关键协议测试为主
- 基础设施范围：当前不引入 turbo 和 runtime schema 层

这些决策共同定义了该仓库的最终 monorepo 形态，而不是迁移过程中的折中状态。
