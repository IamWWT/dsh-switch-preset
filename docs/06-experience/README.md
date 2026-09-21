---
title: 06-experience — 经验库
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# 06-experience — 经验库

## 用途

沉淀项目的**教训、踩坑、最佳实践与复盘**，让经验跨项目复用。"自动记录自己经验"靠本目录 + `AGENTS.md` 铁律 + `MEMORY.md` 状态共同完成。

## 记录协议

1. **每个任务/会话后**至少写一条经验（`scripts/experience.sh` 可快速追加）。
2. **每个项目结束后**写复盘：`<项目名>-复盘.md`。
3. **一般性教训**提升为 `AGENTS.md` §4 铁律（编号 + 日期 + 原因）或 `standards/` 规范条目。
4. 条目格式：场景 → 问题 → 根因 → 解决 → 适用范围。

## 条目模板

```markdown
## {{YYYY-MM-DD}} {{主题}}

- **场景**: （什么项目/什么操作）
- **问题**: （发生了什么）
- **根因**: （为什么）
- **解决**: （怎么修/怎么防）
- **适用范围**: （哪些项目类型适用）
```

## 当前内容

- `lessons-from-opscrew.md` — opscrew-java 实战经验提炼（框架规则的主要来源）。
