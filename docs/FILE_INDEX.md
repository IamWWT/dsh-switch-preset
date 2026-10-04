---
title: FILE_INDEX - 文件索引
type: index
status: active
version: 2.1.0
date: 2026-09-26
owner: AI + 维护人
applies_to: dsh-switch-preset
---

# FILE_INDEX - 文件索引

> 由 Agent 维护：每次新增/删除/移动文件后更新本表。
> 更新: 2026-10-05 | 项目: dsh-switch-preset
> 2026-10-05 v0.6.0 补录：src/host/memory.ts、test/memory-test.mjs；src/host/command.ts（第 4 条命令）、
> src/host/route.ts（enrich 第 6 参 + B1 未达阈值投递）、src/shared/contracts.ts（MemoryContextResult/RouteEnrich）、
> src/shared/router-settings.ts（Config 增 kbRoot）。
> 2026-09-28 v0.5.1 补录：src/host/router.ts、src/host/route.ts、src/host/settings.ts、
> src/client/settings-card.ts、src/client/settings-api.ts、src/shared/router-settings.ts、
> src/shared/threshold.ts、test/router-test.mjs、test/settings-test.mjs。
> 2026-09-26 文档对齐审计：版本提及（README 0.4.1）、安装方式（tgz，无 link）、环境表述（环境支持矩阵）对齐；
> 补录 specs/20260925-native-entry-ui 三件套、test/picker-test.mjs、scripts/paths.sh。
> 2026-09-21 清理：移除 init 脚手架残留（MANUAL/prompts/语言模板/工程工具脚本/空壳占位/无效 ADR-001 与临时实例产物 test-home），实证归档 docs/05-testing/。

## 根目录

- README.md - 项目总览（v0.4.1：留在当前会话 + /list-preset + recompose 强制切换 + 原生 Menu 选择器）
- AGENTS.md - Agent 工作协议（单一入口）
- MEMORY.md - 当前状态/待办/硬约束
- LICENSE - Apache License 2.0
- .gitignore - 忽略规则（node_modules/.npm-cache/lib/lib-test/test-home 等）
- package.json - 插件清单（dsh 字段/双端 exports/构建脚本）
- package-lock.json - 依赖锁定（可复现构建）
- tsconfig.json - Host 侧 TS 配置（Node，strict）
- tsconfig.client.json - Client 侧 TS 配置（浏览器）
- cordis.patch.yml - DSH bundle 补丁（insert 实例化行；空数组不加载）
- CHANGELOG.md - 版本变更记录
- lib/ - 构建产物（运行必需，dsh 加载 lib/index.js + lib/client.js）

## docs/

- docs/FILE_INDEX.md - 本文件
- docs/README.md - 文档体系总览
- docs/REQUIREMENTS.md - 需求演进单一事实源
- docs/TROUBLESHOOTING.md - 排障记录（现象→根因→修复→预防 + DSH API 基线）
- docs/00-request/README.md - 需求摄入协议
- docs/00-request/request.md - 需求摄入正式版（目标锚定/澄清记录/假设表）
- docs/01-requirements/prd.md - PRD 正式版（F-01~F-08 + NFR）
- docs/02-design/architecture.md - 架构设计 v3.0.0（边界/状态模型/调用链图/注入清单/框架边界）
- docs/02-design/switch-preset-flow.mmd - 切换调用链 mermaid 源码（mmdc 渲染）
- docs/02-design/switch-preset-flow.png - 调用链图导出（PowerPoint/文档引用）
- docs/02-design/decisions/README.md - ADR 规范
- docs/02-design/decisions/adr-002-recompose.md - ADR-002（已开始会话 recompose 强制切换，取代 ADR-001）
- docs/04-progress/README.md - 进度日志规范
- docs/04-progress/PROGRESS.md - 进度真源（✅/🔄/⏭）
- docs/04-progress/SESSION.md - 会话交接单（新会话先读）
- docs/05-testing/README.md - 测试报告规范
- docs/05-testing/2026-09-21-recompose-production-proof.md - 实证：recompose 生产生效（事件/提示词/工具）
- docs/05-testing/system-prompt-seq8.txt - 实证附件：切换前 learning 完整 system prompt（11077 字符）
- docs/05-testing/system-prompt-seq552.txt - 实证附件：切换后 video 完整 system prompt（10388 字符）
- docs/06-experience/README.md - 经验库规范
- docs/07-ops/README.md - 运行手册规范
- docs/specs/README.md - SDD 规格目录说明（三件套：spec→plan→tasks）
- docs/specs/001-switch-preset/spec.md - 规格 001（AC-1~AC-16，用户已确认）
- docs/specs/001-switch-preset/plan.md - 技术规划 001
- docs/specs/001-switch-preset/tasks.md - 任务拆解 001（T1~T6）
- docs/specs/002-router-preset/spec.md - 规格 002（/router-preset 概率路由；v0.5.0 交付、v0.5.1 结项 U1，含实测证据与未决项）
- docs/specs/20260925-native-entry-ui/spec.md - 规格 20260925（原生 Menu 入口交互修复，v0.4.1）
- docs/specs/20260925-native-entry-ui/plan.md - 技术规划 20260925（Menu/portal 契约与回退）
- docs/specs/20260925-native-entry-ui/tasks.md - 任务拆解 20260925（含未完成项：全量 check 与隔离实例验收）

## src/（源码）

- src/index.ts - Host 入口（name/inject/VERSION/apply + settings/sessionController/webServer 二级注入 + 再导出 Config）
- src/host/switch.ts - 切换/列表纯逻辑（select / recompose 强制 / 降级默认，可单测）
- src/host/router.ts - 概率判定引擎（ModeScorer 接口 + LocalModeScorer，可插拔 JEV 接入点）
- src/host/route.ts - `/router-preset` 三步编排（判定 → 复用 switchPreset 切换 → 投递）+ 路由参数归一化
  + v0.6.0：可选第 6 参 `enrich`（记忆增强投递）+ B1 修复（未达阈值投递判定详情+原话到当前模式）
- src/host/memory.ts - v0.6.0 `/router-preset-memory` 记忆加载（kbRoot 四层回退 + L1 画像/L2 项目/L3 日记 + 失败降级）
- src/host/settings.ts - v0.5.1 设置面（volatile `routerSettings` 读/写/watch + REST 数据面 + host 侧阈值校验）
- src/host/command.ts - 四条命令注册 + ctx 服务组装（buildSwitchDeps 惰性解析 settings/sessionController/路由参数/kbRoot）
- src/host/types.ts - cordis Context 最小服务类型扩展
- src/client/entry.ts - Client 入口（ModuleLoader.load + 模式选择器 + `plugins.bundle.config` 配置卡注册）
- src/client/ui.ts - React 组件（模式选择器：中文名/描述弹层，h 函数式）
- src/client/settings-card.ts - v0.5.1 配置卡（自动切换开关 + 判定阈值 + 保存/恢复默认 + 失败文案）
- src/client/settings-api.ts - v0.5.1 配置卡数据面（REST 适配器 + 长轮询热同步 + 明确错误）
- src/shared/contracts.ts - 跨端契约（PresetRow/AgentPresetsLike/SwitchDeps/常量单一真源 + v0.6.0 MemoryContextResult/RouteEnrich/MEMORY_ROUTER_COMMAND_NAME）
- src/shared/router-settings.ts - v0.5.1 路由参数（类型/Config schema/归一化/边界，跨端单一真源；v0.6.0 Config 增 `kbRoot` volatile 字段）
- src/shared/threshold.ts - v0.5.1 阈值默认值 0.6 的唯一常量定义（避免 route↔settings 成环）

## test/（测试）

- test/smoke-test.mjs - 冒烟（产物/版本四处同步/导出完整性/Config 与配置区接线）
- test/switch-test.mjs - switch/list 纯逻辑 10 组单测（v1.2 矩阵：select/recompose/降级/报错链）
- test/picker-test.mjs - 模式选择器（Menu 接线/弹层数据）单测
- test/router-test.mjs - `/router-preset` 判定/阈值/投递 22 项单测（v0.5.1 含可配参数用例；v0.6.0 未达阈值断言随 B1 语义更新）
- test/memory-test.mjs - v0.6.0 记忆加载 6 项单测（kbRoot 解析/L1+L2+L3 加载/无关原话不加载/缺失知识库降级）
- test/settings-test.mjs - v0.5.1 路由参数 25 项单测（归一化/写入校验/门面/REST/Config schema/配置卡片）

## scripts/（构建与安装）

- scripts/build.mjs - 双端 esbuild + 产物门禁（host 导出/命令名/client 无顶层 import/export + node --check）
- scripts/typecheck.mjs - 双 tsconfig --noEmit
- scripts/install-to-dsh.sh - 一键安装（强制显式 TARGET_DSH_HOME；构建→测试→按源码路径装→验证）
- scripts/paths.sh - 共享 bash 路径解析（定位 deepseek-harness；不含机器专属路径）
- scripts/doc-check.sh - 文档一致性检查（工程工具，AGENTS.md 引用）
- scripts/quality-gate.sh - 质量门禁（工程工具，AGENTS.md 引用）
- scripts/journal.sh - 进度日志（工程工具，AGENTS.md 引用）
- scripts/experience.sh - 经验记录（工程工具，AGENTS.md 引用）
- scripts/handoff.sh - 会话交接单更新（工程工具，AGENTS.md 引用）

## standards/（工程规范）

- standards/README.md - 规范总览
- standards/security.md - 安全规范
- standards/reliability.md - 可靠性规范
- standards/performance.md - 性能规范
- standards/observability.md - 可观测性规范
- standards/testing.md - 测试规范
- standards/code-style.md - 代码风格
- standards/documentation.md - 文档纪律
- standards/process.md - 工艺流程
- standards/interfaces.md - 接口管理
- standards/quality-gates.md - 质量门禁
- standards/enterprise/README.md - 企业规范
- standards/languages/node.md - TypeScript/Node 适配