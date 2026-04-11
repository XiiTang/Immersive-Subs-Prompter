# A-B Loop Redesign Design

## Goal

彻底重构 A-B 循环能力，统一桌面端与插件端的循环语义、时间边界处理、字幕高亮与滚动行为。

本次设计必须满足以下结果：

- 点击播放、单句循环、A-B 按钮、进度条拖动，都不会触发“用户交互暂停自动跟随”
- A-B 按钮默认显示 `AB`
- 第一次点击任意句子后，该句显示 `A`，其余句子仍显示 `AB`
- 第二次点击任意其他句子后，按时间先后分配 `A` 和 `B`
- A-B 生效后，插件端继续正常发送时间更新
- 桌面端继续基于预计时间驱动高亮与滚动
- 在 `B -> A` 回跳边界，高亮和滚动只能从 `B` 直接切回 `A`
- 在 `B -> A` 回跳边界，高亮不能短暂跳到 `A` 的上一句，也不能短暂跳到 `B` 的下一句

## Non-Goals

本次设计不包含：

- 改造整体播放同步架构为“插件唯一真相源”
- 引入新的兼容层以同时保留旧 A-B 循环实现
- 通过视觉区间染色突出整个 A-B 范围
- 为旧的循环状态字段增加长期兼容适配器
- 修改非循环相关的字幕布局、虚拟化或 pretext 主渲染模型

## Current Problems

当前实现存在以下结构性问题：

- 桌面端的 A-B 循环状态分散在 `abLoopStartCueIndex`、`activeAbLoopRange`、`seekRequest`、`displayedPlaybackTime` 裁剪逻辑中，缺少统一语义
- 插件端只执行 loop 并发送普通时间更新，桌面端难以区分一次时间回退到底是用户 seek、单句循环，还是 A-B 边界回跳
- 自动跟随暂停逻辑主要依赖 DOM 事件推断，控制型交互与阅读型交互没有明确分层
- 桌面端目前主要通过时间裁剪修复 A-B 显示问题，但在 `B -> A` 边界仍然可能先命中相邻错误字幕，再被下一帧修正
- A-B 按钮的视觉语义无法表达“待选端点”和“已确定端点”之间的区别

## Product Decision

采用“共享循环会话模型”。

这不是“插件端唯一真相源”，也不是“桌面端纯推断”。

具体含义是：

- 插件端负责真实循环执行、时间上报和边界事件语义
- 桌面端继续负责预计时间驱动的字幕高亮、滚动和显示连续性
- 两端围绕同一份循环会话语义工作，而不是各自猜测对方状态

## Shared Loop Session Model

### Session Shape

两端围绕同一套最小循环语义建模：

- `mode`: `single` | `ab`
- `startMs`
- `endMs`
- `anchorCueIndex`
- `origin`: `single-loop` | `ab-loop`
- `status`: `inactive` | `running`
- `boundaryTransition`: `none` | `loop-wrap`

### Ownership

插件端拥有：

- 真实视频时间
- 真实循环回跳执行
- 边界事件上报

桌面端拥有：

- A-B 选点 UI 状态
- 基于预计时间的显示推进
- 高亮字幕与自动滚动决策

### Shared Rule

桌面端不得仅根据“时间突然变小”来推断发生了 A-B 回跳。

插件端必须在 `B -> A` 回跳时显式上报 `loop-wrap` 边界语义，桌面端据此执行高亮和滚动保护。

## Desktop State Model

桌面端循环相关状态拆成三组，职责严格分离。

### 1. `loopSelectionState`

只负责 A-B 选点 UI。

状态：

- `idle`
- `selecting-second(anchorCueIndex)`
- `active(startCueIndex, endCueIndex)`

职责：

- 决定按钮显示 `AB`、`A`、`B`
- 决定首次点击、第二次点击、取消操作如何转移
- 决定 active A-B 端点在 UI 上如何标记

### 2. `loopPlaybackState`

只负责当前真实循环会话的显示语义。

状态来源：

- 本地发起的控制命令
- 插件端返回的 loop session / loop-clear / boundary transition

职责：

- 提供当前循环窗口给预计时间显示
- 告诉高亮逻辑当前是否处于 single loop 或 A-B loop
- 告诉滚动逻辑当前是否发生 `loop-wrap`

### 3. `autoFollowPauseState`

只负责自动跟随暂停原因。

允许暂停的原因：

- `manual-scroll`
- `manual-touch-scroll`
- `text-selection`
- `pointer-selection-drag`

不允许暂停的控制型交互：

- `play-toggle`
- `single-loop-toggle`
- `ab-anchor-first-click`
- `ab-anchor-second-click`
- `slider-scrub`
- `programmatic-seek`
- `loop-wrap`

## Extension State Model

插件端保留“真实播放执行者”的角色，但补齐边界语义。

### Loop Session

插件端 loop controller 持有：

- `mode`
- `startMs`
- `endMs`
- `anchorCueIndex`
- `origin`
- `programmaticSeekReason`

其中 `programmaticSeekReason` 至少包含：

- `none`
- `manual-control`
- `loop-wrap`

### Plugin Responsibilities

插件端必须：

- 在建立 loop 时保存完整会话
- 在到达 `endMs` 时执行回跳到 `startMs`
- 在回跳发生时发送带 `loop-wrap` 原因的时间更新
- 在 loop 运行期间继续正常发送普通 `time-update`
- 在 loop 被清除时显式发送 loop clear 信号

插件端不得：

- 停止普通时间更新，只发送 loop 事件
- 让桌面端通过裸时间戳自行猜测回跳原因

## UI Design For `AB / A / B`

### Default State

所有句子的 A-B 按钮默认显示 `AB`。

`AB` 的含义是：

- 当前句可作为 A-B 循环端点
- 当前还没有被确定为 A 或 B

### First Click

当点击任意句子的 `AB`：

- 当前句按钮变成 `A`
- 其他所有句子继续显示 `AB`
- 系统进入 `selecting-second(anchorCueIndex)` 状态

这里不预先把其他句子显示成 `B`，因为第二次点击既可能点在前面，也可能点在后面。

### Second Click

当点击第二个句子时：

- 比较两个句子的时间先后
- 时间更早的句子显示 `A`
- 时间更晚的句子显示 `B`
- 其他所有句子恢复显示 `AB`
- 同时建立 A-B 循环

### Reordering Rule

如果第二次点击的句子在第一次点击句子之前：

- 循环区间仍然建立成功
- 视觉端点自动对调为“更早的是 `A`，更晚的是 `B`”

### Active Loop State

当 A-B 循环已经建立并运行时：

- 起点句显示 `A`
- 终点句显示 `B`
- 其他所有句子保持 `AB`

不引入整段区间常驻高亮样式。

原因：

- 避免与当前播放高亮竞争主视觉
- 降低重新定义 A-B 区间时的认知负担
- 保持“端点语义”和“播放语义”分离

### Cancel Rule

当处于 `selecting-second(anchorCueIndex)` 状态时，如果再次点击第一次选中的 `A`：

- 取消本次 A-B 选点
- 所有句子恢复 `AB`
- 不建立 loop session

## Interaction Rules

### Mutual Exclusivity

单句循环与 A-B 循环互斥。

规则：

- 开始 A-B 选点时，清除当前 single loop
- 激活 single loop 时，清除当前 A-B 选点和 active A-B loop UI
- A-B 建立成功后，single loop 不得继续保持激活样式

### Control Interactions

以下操作均属于控制型交互，不得触发自动跟随暂停：

- 播放 / 暂停
- 单句循环开关
- A-B 第一次点击
- A-B 第二次点击
- 点击某一句直接 seek
- 进度条拖动与释放
- A-B `loop-wrap`

### Reading Interactions

以下操作属于阅读型交互，可以触发自动跟随暂停：

- transcript 区域滚轮滚动
- transcript 区域触摸滚动
- 文本选中
- 在 transcript 内拖拽形成选择

## Time Sync And Display Model

### Core Principle

桌面端继续使用当前“预计时间 + 插件时间更新校正”的模型。

本次重构不改变这一主同步结构：

- 插件端持续发送 `time-update`
- 桌面端依据 `currentTime + lastUpdate + playbackRate` 推进预计时间
- 收到新的时间更新后重新校正基线

### Loop Window Display

当存在 active loop session 时，桌面端仍然将显示时间约束在 loop window 内：

- single loop: `[cue.start, cue.end]`
- A-B loop: `[A.start, B.end]`

但本次设计不再仅依赖时间裁剪解决边界问题。

### Boundary Transition

当插件端发送 `loop-wrap`：

- 桌面端立即把显示基线重设到 `A.start`
- 当前激活字幕块立即切回 `A`
- 自动滚动锚点立即切回 `A`
- 此次跳转被标记为程序性循环边界跳转，而非普通 seek

这条规则用于防止桌面端在 `B -> A` 边界错误命中 `B + 1` 或 `A - 1`。

## Highlight And Scroll Protection

### Highlight Rule

高亮采用“两层判定”：

第一层：

- 按当前显示时间落在哪个 cue/block 内决定 active block

第二层：

- 若本次更新包含 `loop-wrap`
- 直接将 active block 绑定到 `A`
- 跳过一次边界外邻句判定

结果要求：

- `B` 播放期间保持高亮 `B`
- 发生 `B -> A` 回跳后，下一次高亮直接切到 `A`
- 不允许短暂切到 `A - 1`
- 不允许短暂切到 `B + 1`

### Scroll Rule

自动滚动的锚点原因分为：

- `playback-follow`
- `seek-recenter`
- `resize-reproject`
- `loop-wrap-follow`

当原因为 `loop-wrap-follow` 时：

- 直接以 `A` block 为滚动目标
- 不经过边界外 block 的重投影过程

这保证回跳后视口直接回到正确起点，而不是先滚到错误句附近再被下一帧修正。

## Auto-Follow Pause Redesign

### Current Issue

当前自动跟随暂停逻辑主要从 DOM 事件反推用户意图，导致控制型交互和阅读型交互容易互相污染。

### New Model

自动跟随是否暂停，不由“用户是否点击过容器”决定，而由“交互意图类型”决定。

规则：

- 只有阅读型交互可以进入 pause state
- 控制型交互永远不进入 pause state
- 只有 pause state 才允许 schedule resume

### Resume Rule

恢复自动跟随只在以下场景发生：

- 文本选择清除
- 指针拖拽选择结束
- 手动滚动停止并经过延迟窗口

控制型交互不产生 pause，也不需要 resume。

## Event Flow

### A-B Creation Flow

1. 用户点击某句 `AB`
2. 桌面端进入 `selecting-second`
3. 用户点击第二句
4. 桌面端按时间先后计算 `A`、`B`
5. 桌面端发送 `loop(startMs, endMs, cueIndex, origin=ab-loop)`
6. 插件端建立真实 loop session
7. 插件端返回 loop started
8. 桌面端进入 active A-B loop 状态

### A-B Wrap Flow

1. 插件端检测到 `currentTime >= endMs`
2. 插件端执行程序性 seek 到 `startMs`
3. 插件端发送带 `loop-wrap` 原因的时间更新
4. 桌面端重设显示基线到 `A.start`
5. 桌面端直接将高亮和滚动锚点切回 `A`

### A-B Cancel Flow

1. 用户在 selecting 状态再次点击已选中的 `A`
2. 桌面端清除 loopSelectionState
3. 所有句子恢复 `AB`
4. 若未建立 loop session，则不向插件端发送 loop 命令

## Reset Rules

桌面端提供三个明确的复位入口：

- `resetLoopSelection()`
- `resetLoopPlayback()`
- `resetLoopUiAndPlayback()`

### `resetLoopSelection()`

只清理 UI 选点状态：

- 恢复所有按钮为 `AB`
- 清除 pending A 端点

### `resetLoopPlayback()`

只清理真实循环会话显示状态：

- 清理 single loop / A-B loop active 标记
- 清理 loop boundary transition

### `resetLoopUiAndPlayback()`

同时清理 UI 选点与真实循环会话显示状态。

触发场景：

- 切换主字幕或副字幕轨道
- 视频切换
- active tab 改变
- 扩展断连
- 字幕重新加载
- 插件端显式 loop cleared

## Error Handling And Mismatch Rules

### Invalid Range

若计算出的 loop 区间无效，例如：

- `end <= start`
- cue 不存在
- cue 时间不可用

则：

- 不建立 loop session
- UI 返回默认 `AB` 状态
- 不保留半激活端点

### Desktop Has UI But Plugin Lost Loop

如果桌面端仍显示 active A-B，但插件端 loop 已清除：

- 以插件端真实状态为准
- 清理桌面端 active range
- 所有按钮恢复 `AB`

### Plugin Has Loop But Desktop Cues Changed

如果插件端 loop 仍在运行，但桌面端 cue 索引失效：

- 立即清空桌面端 loop UI
- 不继续使用旧 cue 计算高亮或滚动保护

### Message Ordering

对于 `loop-wrap` 所在的小时间窗口：

- `loop-wrap` 边界语义优先级高于同窗口内的普通时间推进消息
- 普通消息只能用于后续校正，不得覆盖已经确认的边界回跳处理

## Component Responsibilities

### `SubtitleView.vue`

负责：

- 管理 `loopSelectionState`
- 管理 `loopPlaybackState`
- 向插件端发送控制命令
- 协调预计时间与 loop window

不得：

- 将控制型交互误记为自动跟随暂停
- 仅通过局部 if 分支拼接 A-B 状态

### `TranscriptSurface.vue`

负责：

- 基于 active block 渲染高亮
- 基于锚点原因执行自动滚动
- 在 `loop-wrap-follow` 时执行边界保护滚动

不得：

- 自行猜测一次时间回退是否为 A-B 回跳
- 在 `loop-wrap` 时先经过错误相邻 block 再修正

### `useTranscriptSelection.ts`

负责：

- 管理阅读型交互导致的暂停
- 管理 resume timer

不得：

- 通过通用容器点击推断控制型交互
- 对 slider 或按钮点击触发 pause

### `LoopController.js`

负责：

- 维护插件端 loop session
- 执行真实回跳
- 在回跳时发出 `loop-wrap` 语义

不得：

- 将 A-B 回跳隐藏成普通时间更新

### `VideoStateGatherer.js`

负责：

- 发送普通时间更新
- 在需要时携带程序性 seek / loop-wrap 原因

不得：

- 丢失时间更新连续性

## Testing Strategy

### Desktop Tests

需要覆盖：

- `AB -> A -> A/B` 的按钮状态流
- 第二次点击在前一句时，最终自动对调 `A/B`
- 再次点击首个 `A` 会取消选点并恢复全部 `AB`
- 点击播放、单句循环、A-B、slider 拖动都不会触发 auto-follow pause
- 滚轮、文本选择、阅读拖拽会触发 auto-follow pause
- A-B 建立后，预计时间继续在区间内推进高亮与滚动
- 在 `loop-wrap` 时高亮直接从 `B` 切到 `A`
- 在 `loop-wrap` 时滚动直接回到 `A`
- 在 `loop-wrap` 边界不会命中 `A - 1` 或 `B + 1`

### Extension Tests

需要覆盖：

- single loop 建立、运行、清理
- A-B loop 建立、运行、清理
- `currentTime >= endMs` 时发送 `loop-wrap`
- loop 运行期间仍持续发送普通时间更新
- 从 single loop 切换到 A-B 时状态正确清理
- 从 A-B 切换到 seek / play / pause 时状态正确清理

## Acceptance Criteria

本次设计的验收标准为：

- 所有 A-B 按钮默认显示 `AB`
- 第一次点击后，仅该句显示 `A`
- 第二次点击任意其他句后，按时间先后显示 `A` 与 `B`
- 其他所有句子始终显示 `AB`
- A-B 循环运行时，插件端继续正常发送时间更新
- 桌面端继续按预计时间推进字幕高亮和滚动
- 播放、单句循环、A-B、进度条拖动不会触发“用户交互暂停自动跟随”
- 在 `B -> A` 边界，高亮和滚动只允许从 `B` 直接切到 `A`
- 在 `B -> A` 边界，高亮不得短暂跳到 `A` 的上一句或 `B` 的下一句

## Implementation Boundaries

实现阶段应当：

- 直接替换现有 A-B 循环状态拼接逻辑
- 删除为旧边界行为服务的临时判断
- 为新状态模型补齐单元测试与组件测试

实现阶段不应当：

- 保留旧 A-B 逻辑作为隐藏 fallback
- 继续扩张局部补丁式条件判断
- 在没有边界语义的前提下继续让桌面端猜测回跳原因
