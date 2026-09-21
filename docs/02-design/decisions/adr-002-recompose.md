---
title: ADR-002 — 已开始会话换模式：recompose 强制重装配
type: adr
status: accepted
version: 1.0.0
date: 2026-09-18
owner: AI + 用户
applies_to: dsh-switch-preset
---

# ADR-002 — 已开始会话换模式：recompose 强制重装配

> 取代 ADR-001（fork/create 进新会话方案，v0.3.0 起废弃，已删除）。

## 背景

用户要求"已开始的会话也能换模式"（原话：*当前会话已经有历史会话了，总之我要这样*）。
DSH 框架默认禁止：`agentPresets.select` 按 `turnBoundary` 对已开始会话抛 `agent-preset/locked`
（换 preset = 换工具集，历史 tool 调用在新组合下可能无法解析）。

## 决策

`/switch-preset <id>` 三级策略：

1. **空会话**：`agentPresets.select(agent, id)` —— 框架正规路径（自带锁定检查）；
2. **已开始会话**：`agentPresets.recompose(agent.ctx, id)` **强制重装配**（该方法无锁定
   检查，是 select 内部通过检查后调用的底层操作）+ `session.append('agent-preset/selected',
   { agentPreset })` 落盘（保证投影/header 一致、重启按新模式重建）；
3. **recompose 不可用**（宿主版本差异）：降级 `settings.update('agent-presets', { default })`
   写默认模式；再失败 → 明确报错，不静默。

## 备选

- `select` 原地换：仅空会话可用，不满足需求；
- fork/create 进新会话（ADR-001）：用户明确否决（要留在当前会话）；
- 拒绝并提示：用户不接受。

## 影响

- 当前会话（含历史）**就地切换模式**，立即生效（生产实证见 `docs/05-testing/2026-09-21-recompose-production-proof.md`）；
- 风险：历史中旧模式独有工具的调用记录可能无法在新组合解析——成功文案附提示；
- 事件 `agent-preset/selected` 持久化，与 `select` 内部记录路径一致，无旁路状态。