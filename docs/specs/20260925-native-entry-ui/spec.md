---
title: 原生入口交互修复
type: specification
status: active
version: 0.4.1
date: 2026-09-25
---

## 当前状态

- 文档性质：规格（原生入口 UI，已交付）
- 对应版本：v0.5.0（2026-09-28）
- 状态：有效（如与实现不符，以代码与 `docs/REQUIREMENTS.md` 为准）
- 维护者：AI + 用户


用户已授权：Hub 恢复官方终端的多类型下拉；Switch Preset 菜单清楚可见、位置合理。当前仓库范围：dsh-switch-preset。

使用 DSH 原生 Menu，向上展开、右缘对齐、portal 避免裁剪；恢复主题背景、键盘导航、焦点返回。

验收：不修改 harness；官方入口/菜单契约不丢失；Windows 验证，Ubuntu 不引入平台分支；保留既有功能；隔离 3084 验证后才能交付。
