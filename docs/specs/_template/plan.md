---
title: "PLAN-<id>: <特性名> 技术规划"
type: plan
status: draft
version: 0.1.0
date: 2026-09-17
---

# PLAN-<id> 技术规划

## 技术架构

- **Host/Client 划分**：Host（Node：路由/状态/外部服务）↔ Client（浏览器：插槽/卡片/UI）各自职责
- **路由清单**：前缀（唯一，如 `/api/<plugin>/…`）、方法、鉴权要求
- **状态模型**：持久化位置（`$DSH_HOME/profiles/<profile>/<plugin>/` 或 stateDir）、文件格式、并发写策略
- **数据通道**：Host→Client 事件（事件域/事件名）、Client→Host 调用方式

## 技术选型

每项选型的理由（为什么复用 `sessionController.prompt` / `dsh-settings` 这类既有机制而不是重写）。

## 风险与对策

| 风险 | 对策 |
|------|------|
| 鉴权门禁兼容（如 dsh-global-auth） | … |
| 主题（--dsw-* token，明暗双模） | … |
| 原生模块 / 性能 | … |
