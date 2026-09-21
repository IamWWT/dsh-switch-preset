---
title: 文档体系总览
type: index
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: docs/ 全部文档
references:
  - standards/documentation.md
  - AGENTS.md
---

# docs — 文档体系总览

> 本文件回答两个问题：**docs 与工艺流程的对应关系**、**每类文档为什么必须存在**。
> 编制规范（头方式/索引/引用/依赖矩阵）见 `standards/documentation.md`。

## 1. docs 与工艺流程对应关系

| 工艺阶段 | docs 分册 | 核心文件 | 一句话职责 |
---------|----------|---------|-----------|
| P0 需求摄入 | `docs/00-request/` | request.md | 用户原话 + 假设 + 澄清，需求唯一真源 |
| P0 需求定义 | `docs/01-requirements/` | prd.md | 功能清单 + 可测试验收标准 |
| P1 设计选型 | `docs/02-design/` | architecture.md + decisions/adr-*.md | 模块边界 + 决策理由 |
| P2 任务计划 | `docs/03-plan/` | tasks.md | 里程碑 + 任务 + DoD |
| P3/P4 执行 | `docs/04-progress/` | YYYY-MM-DD.md | 诚实过程记录（含失败） |
| P5 测试加固 | `docs/05-testing/` | test-plan.md + report-*.md | 测试证据 |
| 经验沉淀 | `docs/06-experience/` | YYYY-MM-DD.md + 复盘 | 教训与最佳实践 |
| P6 交付运维 | `docs/07-ops/` | runbook.md + troubleshooting.md | 部署/排障/回滚 |
| 全流程 | `docs/FILE_INDEX.md` | FILE_INDEX.md | 全仓库导航 |
| 全流程 | `docs/glossary.md` | glossary.md | 术语统一 |

## 2. 每类文档必要性速查

> 详细论证见 `standards/documentation.md` §4。核心判据：**没有它会出什么问题？**

| 文档 | 没有它的后果 |
------|-------------|
| request.md | 范围漂移、假设无据可查 |
| prd.md | 无法验收、开发凭感觉 |
| architecture.md + ADR | 耦合失控、决策反复 |
| tasks.md | 进度不可跟踪 |
| progress/*.md | 无法复盘、AI 跨会话失忆 |
| testing/*.md | 无法证明"完成" |
| experience/*.md | 重蹈覆辙 |
| ops/runbook.md | 无法运维交接 |
| FILE_INDEX.md | 文档不可发现 |
| glossary.md | 术语歧义 |

## 3. 什么信息必须落 md

需求与假设、决策与理由、过程事实（含失败）、经验教训、状态与约束、契约与接口、验收证据——**七类信息禁止只存在于对话或代码注释**，理由：上下文有界、可追溯、可审查、防幻觉、并行协作。详见 `standards/documentation.md` §5.1/§5.2。

## 4. 文档依赖链

```
一句话需求 → request.md → prd.md → architecture.md+ADR → tasks.md
   → progress（每批）→ testing（证据）→ experience+MEMORY（回流）→ ops/runbook（交付）
```

变更只能顺流传播；每类文档的联动范围见 `standards/documentation.md` §4.2 依赖矩阵。
