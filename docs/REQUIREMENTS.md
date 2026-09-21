---
title: REQUIREMENTS — dsh-switch-preset 需求演进记录
type: requirements
status: active
version: 1.0.0
date: 2026-09-16
owner: AI + 用户
applies_to: dsh-switch-preset
---

# REQUIREMENTS — 需求演进单一事实源

> 每轮需求/反馈 → 决策 → 实现落点 → 验收，按时间记录。原始需求/规格见
> `docs/00-request/request.md` 与 `docs/specs/001-switch-preset/spec.md`。

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