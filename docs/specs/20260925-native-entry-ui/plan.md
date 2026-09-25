---
title: 设计与契约
type: specification
status: active
version: 0.4.1
date: 2026-09-25
---

基线：DSH 0.1.7-rc.1 / 46a7f68b09。

使用 DSH 原生 Menu，向上展开、右缘对齐、portal 避免裁剪；恢复主题背景、键盘导航、焦点返回。

Hub：registry.guide 的 providerId/id 完整进入分类快照；声明 keyed 子插槽 sidebar.right.tab.guide.entry，传递 useTabInfo hookContext；无 provider 的普通入口用 Hub 按钮。
Switch：ModuleLoader 平台模块 @deepseek-ai/dsh-client-ui-primitives 的 Menu，通过依赖注入传给组件；side=top/align=end/portal/autoFocus；命令通道保持不变。

回滚：回退本次插件改动并重建；不还原其他人的锁文件或整个 profile。
