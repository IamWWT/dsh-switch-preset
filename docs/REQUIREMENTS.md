---
title: REQUIREMENTS — dsh-switch-preset 需求演进记录
type: requirements
status: active
version: 1.0.0
date: 2026-09-16
owner: AI + 用户
applies_to: dsh-switch-preset
---

## 当前状态

- 文档性质：需求演进真源（需求→决策→实现→验收）
- 对应版本：v0.5.0（2026-09-28）
- 状态：有效（如与实现不符，以代码与 `docs/REQUIREMENTS.md` 为准）
- 维护者：AI + 用户


# REQUIREMENTS — 需求演进单一事实源

> 每轮需求/反馈 → 决策 → 实现落点 → 验收，按时间记录。原始需求/规格见
> `docs/00-request/request.md` 与 `docs/specs/001-switch-preset/spec.md`。

## v0.5.0（2026-09-28，概率路由 `/router-preset`）

- **用户原话**：「如果不给答案可以给出判定某个模式命中的概率，概率第一高的就是要切换的 类似 jev 模型」
  +「就是落到 /router-preset xxx 这个指令里面。等于是这条指令触发 preset 概率判定 + switch preset 操作 +
  用户原本内容在切换后的 preset 模式下的后续输入 agent 交互」。
- **澄清决策**（用户确认）：
  1. 概率引擎：**先落本地确定性打分**（零依赖/可单测/离线可用），接口做成可插拔，
     将来接入 JEV 类模型时命令层与客户端零改动；
  2. 阈值：Top-1 ≥ **0.6** 才自动切换；低于阈值**只提示不切换**（避免低置信度切错模式）；
  3. 原话接力机制：先按"客户端接力"设想实现 → **实测推翻**（见下"实现落点"第 4 条），改为 Host 侧投递。
- **实现落点**：
  1. `src/host/router.ts`：`ModeScorer` 接口 + `LocalModeScorer`（engine `local-keyword-v1`）；
     强特征表（人工提炼高区分度词，权重 3）+ 各模式 name/description 自动派生弱特征（权重 1）+
     均匀先验 → 归一化为概率；输出含**命中词**（可解释）。
     `undetermined`（全部并列）标记：无判别力时不得给"冠军"推荐。
  2. `src/host/route.ts`：三步编排（判定 → 复用 `switchPreset` 切换 → 投递）；
     切换失败**不投递**；投递通道缺失/被拒/抛错三态均如实回显"未投递"并指导手动重发。
  3. `src/host/command.ts`：注册 `/router-preset`（三条指令并列）；
     `buildSwitchDeps` 新增 `deliverUtterance`（core 服务 `sessionController.prompt`，**不调用任何模型 API**）；
     `src/index.ts` 二级注入 `sessionController` 并惰性解析。
  4. **投递通道的实测结论（重要）**：上游命令 handler 明确"不把命令发给模型"
     （`packages/interaction/commands/src/index.ts`），`CommandResult` 只有
     `{kind,text,sourceEventSeq}`；客户端**没有公开钩子**能观察"用户键入的命令"结果
     （`conversation.composer.bar` 的 `hooks.notices` 是 package-private 且插槽为 single 已被占用）。
     故"客户端接力"只能覆盖插件自己发起的调用，覆盖不了主路径 → 投递落在 Host 侧。
  5. 客户端：模式菜单弹层置顶「⚡ 按内容自动判定模式」（取当前草稿为原话，`useInput` standard hook 读取）；
     只负责展示 Host 返回的判定与投递实况，不再接力。
- **验收（3084 隔离实例，2026-09-28）**：`pnpm check` 全绿（含 `test/router-test.mjs` 15 项）；
  真实 6 模式环境下键入 `/router-preset 帮我把这个项目做成一个演示视频，需要配音和字幕` →
  判定「视频模式 80.3%（命中：视频、配音、字幕、演示视频、项目、演示）」→ `agent-preset/selected{agentPreset:video}`
  → `agent/inbox/spliced`（原话以 `role:"user"` 入队）→ `turn/start` 且 `system/message` 为**视频模式**人设
  → `user/message` 为原话原文（唯一 `turn/end` 错误为 `MISSING_CREDENTIAL`，测试 home 未配 API key，属环境）。
  内置模式（standard/cordis/minimal/ptc）环境下正确输出"**无法判定**"且不切换、不推荐（无判别力）。
- **未决**：3082 安装待用户授权；JEV 类模型接入为后续可选增强（接口已就绪）。

## v1.0（2026-09-16，初始需求）

- **用户原话**：新建一个插件，用斜杠指令切换当前会话模式；切换后会话历史上下文是否继承可在设置中设置；插件名让 Agent 起；探索如何聪明识别 dsh 当前模式；尽量复用框架能力。
- **澄清决策**（用户确认）：
  1. 「会话模式」= DSH 的 Agent preset（复用官方概念）；
  2. 「切换」= 进入新会话（fork=继承历史 / create=干净上下文），原会话保留可切回；
  3. 指令名 `/switch-preset`（用户指定，非 `/mode`）；插件名 `dsh-switch-preset`；
  4. 继承模式下无法更换 preset（DSH 框架锁死）→ fork 复制会话并明确提示。
- **补充需求（规格确认环节用户提问）**：「模式 id 是什么？需要用户自己指定么，能自动弹出么？」
  → 决策：① 无参指令列出当前模式+可用模式（免记 id）；② 新增 client 模式选择器
  （composer 工具行按钮 → roster 弹层点选 → 复用命令通道）。落点：spec §3.3 + AC-11、tasks T4b。
- **实现落点**：Host `ctx.commands` + `ctx.sessionController.create/fork` + `ctx.agentPresets.list`；
  Client `settings.plugin.item` 卡 + `conversation.input.right` 选择器 + `command/executed` 跳转。
- **验收**：`docs/specs/001-switch-preset/spec.md` §4 AC-1~AC-11（临时实例 🔬 / 3082 🖥）。

## v1.1（2026-09-17，用户反馈：切换语义变更 + 新增 list-preset）

- **用户原话**：「不满意, 我需要的是指令后, 留在当前会话, 但是会话默认模式转为目标模式, 而且我加入指令后, 并没有带出我能用什么模式, 是否可以加一个/list-preset 来查看当前 /switch-preset 对应应填写的presetid, 注意list时候应该写明每个preset 对应中文描述(或者设置里面对应的描述)」
- **变更决策**：
  1. **切换语义**：不再 fork/create 新会话、不再自动跳转；`/switch-preset <id>` **留在当前会话**：
     - 空会话（未开始回合）→ `ctx.agentPresets.select(agent, id)` 就地换 preset；
     - 已开始会话（框架锁死 `agent-preset/locked`）→ `ctx.settings.update('agent-presets', { default: id })` 把该模式设为**默认模式**（之后新建会话生效）+ 明确提示。
  2. **新增 `/list-preset`**：列出全部可用 preset 的 **id + 中文名 + 中文描述**（来源 `preset.yml` 的 `name`/`description`），并标注当前会话模式与默认模式。
  3. **移除**：`inheritHistory` 设置项与 client 自动跳转（新语义不再创建会话，二者失去意义；避免纸面配置）。
  4. **保留**：`/switch-preset` 无参列表（与 `/list-preset` 同源）、composer 模式选择器（弹层显示中文名/描述）。
- **验收更新**：spec v1.1 AC-12~AC-16（见 `docs/specs/001-switch-preset/spec.md` 变更记录）。

## 变更记录

| 日期 | 变更 | 原因 | 验收 |
|------|------|------|------|
| 2026-09-16 | v1.0 初稿（含选择器增强） | 初始需求 + 规格确认期用户补充 | AC-1~AC-11 |
| 2026-09-17 | v1.1 切换语义改为"留在当前会话"+ 新增 `/list-preset` + 中文描述 + 移除 inheritHistory/自动跳转 | 用户实测反馈 | AC-1~AC-16 |