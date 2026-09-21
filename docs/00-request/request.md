---
title: 需求摄入 — dsh-switch-preset（会话模式切换插件）
type: request
status: confirmed
version: 1.0.0
date: 2026-09-16
owner: 用户 + AI
applies_to: dsh-switch-preset
---

# 需求摄入 — dsh-switch-preset

## 目标项目

| 项 | 内容 |
|----|------|
| 目标项目路径 | `dsh-plugins/dsh-switch-preset`（相对工作区根 `/home/wwt/Downloads/aigc/proj/deepseek`） |
| 项目说明 | DSH 插件：斜杠指令 `/switch-preset` 切换当前会话的 Agent preset（模式），新会话是否继承历史上下文由设置决定；client 自动跳转到新会话 |
| 联合开发路径 | 无（只读参照：`deepseek-harness/` 源码与文档、`dsh-plugins/dsh-scheduled-send/` 工程范本） |
| 白名单纪律 | write/edit 只允许落在目标项目路径内；白名单外只读参照 |

## 用户原话

> 新建一个插件, 我要求这个插件实现的功能是 用斜/指令可以切换当前会话模式,切换后这个会话历史上下文是否继承可以在设置中设置. 插件名字你看起一个什么名字合适, 另外要怎么聪明识别当前dsh用了什么模式你也需要探索看看, --- 另外能复用框架本身的能力就复用,不要重复造轮子

## 需求提炼

| 项 | 内容 |
|----|------|
| 目标 | 用一个斜杠指令把当前会话切换为另一种 Agent preset（DSH 官方"模式"概念）组成的新会话；历史是否继承可在设置中配置 |
| 用户/场景 | Web GUI（3082 dev web）会话进行中想换模式（如从 standard 换到自定义 preset），不想手动新建会话再挑模式 |
| 核心功能（P0） | ① `/switch-preset` 指令（无参=看当前模式+可用模式；带参=切换）② 设置项「历史上下文是否继承」③ 切换=进入新会话（fork 复制历史 / create 干净上下文）④ client 自动跳转到新会话 |
| 次要功能（P1） | 模式健康度展示、指令输入提示（input hint） |
| 非目标 | 不重写 preset/会话机制（复用 `ctx.agentPresets` / `ctx.sessionController` / `ctx.commands`）；不做 plan mode 管理（DSH 自带 `/plan`）；不改 agent-presets 的 picker；不做模式增删改管理页（用 DSH 自带 roster 管理） |
| 约束 | DSH 框架硬约束：带历史的会话 preset 固定（"only an empty session may switch presets"）；fork 继承源 preset 且需已完成 turn；插件遵循 PLUGIN-DEV-STANDARD（双端、产物门禁、临时实例验证后上 3082） |

## 澄清记录（2026-09-16 一轮确认）

| 决策点 | 候选 | 用户选择 | 回写 |
|--------|------|---------|------|
| 「会话模式」指什么 | A 复用 DSH Agent mode（preset）/ B 插件自定义轻量模式 / C 两者结合 | **A. 复用 DSH 的 Agent mode（preset）** | spec §2 |
| 「切换」与「历史继承」语义 | A 切换=进新会话，继承=复制历史 / B 同会话生效 / C 只同会话 | **A. 切换=进新会话，继承=复制历史**（fork 带历史同 preset；create 干净上下文可指定 preset；原会话保留） | spec §2、§3 |
| 插件名与 UI 范围 | 名字候选 + UI 范围 | 用户自定义：**指令名 `/switch-preset`**（非 `/mode`）；插件名与指令一致取 `dsh-switch-preset`；范围=指令+设置卡片+自动跳转 | spec §3 |

## 假设表

| # | 假设 | 依据 | 影响 |
|---|------|------|------|
| H1 | 插件 npm 名/目录名/bundle 名统一为 `dsh-switch-preset` | 用户指定指令名 `/switch-preset`；工作区约定目录名=npm 名 | 三处一致，改主名需改四处 |
| H2 | 「继承历史=true + 换 preset」受 DSH 框架锁死（带历史会话 preset 固定）；继承模式下 `/switch-preset <preset>` 行为 = **复制当前会话**（preset 保持原样、历史全带），并在成功文本明确提示"继承模式无法更换 preset" | 源码实证：`agent-presets.select()`/`swap()` 按 `turnBoundary`（`lastTurn>0` 或打开回合）拒绝；fork 出的会话带 turn/end 前缀 → lastTurn>0 → 不可 select | 行为矩阵（见 PRD F-04） |
| H3 | 切换后 client **自动跳转**新会话：client 监听 `command/executed` 事件（ui-commands service `this.ctx.emit('command/executed', sessionId, name, result)`）解析新 sessionId → `uiWorkspace.openSession(sessionId)` | 源码实证：`packages/client/ui-commands/src/client/service.ts:405`、`packages/client/ui-workspace/src/client/navigation.ts:139` | 若目标 DSH 版本事件签名变化 → 回退为成功文本提示用户手动点开（标注降级） |
| H4 | create 新会话需带**当前工作区 id**，保证新会话出现在当前会话列表并自动附加到工作区 | 源码实证：`session-controller/commands.ts create()` 支持 `workspaceId`（attachSession）；fork 内部用 `forkWorkspace(source.header)` 继承 | Host 指令需要能从当前会话解析 workspace；解析失败降级为不带 workspace（新会话落在 defaultCwd，仍可被 openSession 打开） |
| H5 | fork 需当前会话存在**已完成 turn**，否则 fork 抛 `session/fork-unavailable`；指令需前置判断并给出明确报错 | 源码实证：`session-controller/commands.ts fork()` 无 `turn/end` 时抛错 | 继承模式下无可 fork turn → 返回 error 文本，不产生半成品 |
| H6 | 「聪明识别当前模式」= 读会话 `agentPreset`（CreateValue/header 投影）+ `ctx.agentPresets.list()`（roster，含健康度）；`/switch-preset` 无参时展示「当前模式 + 可用模式列表（含 broken 标注）」 | 源码实证：`agent-presets list()` Remote、`session-controller` `presetForSession()` | 指令输出以 roster 为单一真源，不硬编码模式清单 |
| H7 | 设置命名空间 `switchPreset`（`inheritHistory: boolean`，默认 false）经 `ctx.settings.installSection` 注册（Host）+ client `settings.plugin.item` 卡片 | 官方 `adding-a-settings-card.md`；PLUGIN-DEV-STANDARD §4.6 | 配置键只声明实际消费的键 |

## 澄清问题（已闭环）

1. 「会话模式」指什么？→ 已确认：DSH Agent mode（preset）
2. 「切换」是否接受"进入新会话"语义？→ 已确认：接受，原会话保留可切回
3. 指令名/插件名？→ 已确认：`/switch-preset` / `dsh-switch-preset`