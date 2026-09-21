---
title: "TASKS-<id>: <特性名> 任务拆解"
type: tasks
status: draft
version: 0.1.0
date: 2026-09-17
---

# TASKS-<id> 任务拆解

> 粒度 = 一个任务一个逻辑改动一个 commit（中文 message，类型前缀）。
> 每完成一项跑 `npm run check`（构建+产物门禁+冒烟）；全部完成后对照 spec 第 4 节逐条验收。

- [ ] T1 <任务>
  - 改动文件：`src/…`
  - done 定义：<可验证的状态>
  - 验证：<命令/UI 操作>
- [ ] T2 <任务>
  - 改动文件：…
  - done 定义：…
  - 验证：…

## 验收对照（Converge）

| 验收项（spec §4） | 结果 | 证据 |
|---|---|---|
| A1 | ⬜ | （命令输出/UI 截图路径） |
