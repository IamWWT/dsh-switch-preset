---
title: 实证 — recompose 强制切换生产生效（session-f6101952）
type: testing
status: active
version: 1.0.0
date: 2026-09-21
owner: AI + 用户
applies_to: dsh-switch-preset
---

# recompose 强制切换生产实证（2026-09-21）

**会话**：`session-f6101952`（agentscope-java 2.0 记忆讲解视频，`~/.dsh-dev`）
**事件流**：`session.v3.jsonl.zstd`（主日志）→ 解压分析（原临时产物已清理，结论留档）。

## 结论

`/switch-preset video` 在**已开始会话**（500+ 事件后）走 recompose 强制路径切换成功，
切换后模型每次请求的完整 system prompt 换成 video 模式提示词（含 skills 引用），
工具行为同步切换。附件为切换前/后两份**完整 system prompt 原文**。

## 证据要点

| 证据 | 内容 |
|---|---|
| 切换事件 | `command/run`(seq544) → `agent-preset/selected`(seq545, video) → `command/done`(seq546)，命令路径落盘实锤 |
| 投影一致 | `agentPreset` 投影终值 = video（重启/resume 保持） |
| 完整提示词对比 | 切前 seq8（learning，11077 字符）↔ 切后 seq552（video，10388 字符）——persona/skills 全文替换 |
| 关键词差异 | learning：费曼/间隔复习/学习画像/memory-；video：video-production/voice-video/type-*/browser-skill/TTS/分镜/口播稿 |
| 切换后工具行为 | vision_html_screenshot×3 / vision_present×2 / spawn_teammate×4 / bash×25 / ask_user_question×2（匹配 video 编排） |

附件：`system-prompt-seq8.txt`（learning full prompt）、`system-prompt-seq552.txt`（video full prompt）。

> 注：完整 prompt 本体**不在会话事件流**（请求级），但 `system/message` 事件持久化了每次请求的
> system message 全文——本条实证即从该事件提取，非推断。
