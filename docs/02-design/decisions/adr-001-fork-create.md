---
title: ADR-001 — 复用 sessionController.create/fork 实现模式切换
type: adr
status: accepted
version: 1.0.0
date: 2026-09-17
owner: AI + 用户
applies_to: dsh-switch-preset
---

# ADR-001 — 复用 sessionController.create/fork 实现模式切换

## 背景

需求：斜杠指令切换"会话模式"，切换后是否继承历史可在设置中配置。DSH 的会话模式官方概念是 agent preset（`agent-presets`），但存在框架约束：已产生消息的会话 preset 锁定（`agent-presets.select` 按 `turnBoundary` 拒绝），带历史 fork 继承源 preset。因此"换 preset + 带历史"不可直接实现。

## 决策

- 继承历史 = `sessionController.fork` 复制当前会话（preset 不变）到新会话；
- 不继承历史 = `sessionController.create(agentPreset)` 新建目标 preset 会话；
- 两次切换都让原会话保留，客户端监听 `command/executed` 自动跳转到新会话。

## 备选

1. 复用 `agentPresets.select` 原地换 preset —— 仅空会话可用，带历史场景直接失败；
2. 自建会话复制/持久化 —— 重造轮子，违反"复用框架能力"；
3. 每模式软性提示（plan-mode 式）—— 不满足"切换即新上下文"的业务语义。

## 结论

选定方案完全建立于既有 `session` 与 `agent-presets` API 之上，插件只实现命令编排、校验、导航与设置；约束（fork 继承 preset）通过成功文本明示，避免产生"切换成功但 preset 未变"的误解。

## 影响

- 命令路径唯一，Client 选择器与键盘指令共享同一 Host 逻辑；
- 接受"继承历史时无法更换 preset"为框架边界并显式告知用户；
- fork 无已完成回合时返回明确错误而非静默成功。