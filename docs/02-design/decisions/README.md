---
title: ADR — 架构决策记录
type: index
status: active
version: 2.0.0
date: 2026-09-21
owner: AI + 维护人
applies_to: dsh-switch-preset
---

# ADR — 架构决策记录

## 什么时候写 ADR

满足以下任一条的决策必须写 ADR：

- 影响多个模块/团队；
- 难以回头（改造成本高）；
- 有多个合理备选方案；
- 违反直觉或容易再次被推翻（如"暂不引入消息队列"）。

简单决策（如"日志用 JSON 格式"）直接在对应规范或架构文档记录，不写 ADR。

## 规范

1. 编号连续：`adr-00N-<slug>.md`，本文件登记编号/标题/状态/日期。
2. 状态机：Proposed → Accepted / Rejected / **Superseded**（被新 ADR 取代的旧 ADR 标注后删除，现状以新 ADR 为准——ADR-001 已于 2026-09-21 删除，由 ADR-002 取代）。
3. **单一真源**：ADR 只是决策记录，实现细节以代码为准；ADR 与实现冲突时以代码为准并修正 ADR。
4. 写 ADR 时同步更新：本 `README.md`、`docs/FILE_INDEX.md`、必要时 `AGENTS.md` 铁律与 `MEMORY.md`。

## 索引

| ADR | 标题 | 状态 | 日期 |
|-----|------|------|------|
| adr-002-recompose | 已开始会话换模式：recompose 强制重装配 | Accepted | 2026-09-18 |
| ~~adr-001-fork-create~~ | ~~复用 create/fork 实现模式切换~~（v0.3.0 起废弃） | Superseded → 已删除 | ~2026-09-16 |