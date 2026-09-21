---
title: FILE_INDEX - 文件索引
type: index
status: active
version: 2.0.0
date: 2026-09-21
owner: AI + 维护人
applies_to: dsh-switch-preset
---

# FILE_INDEX - 文件索引

> 由 Agent 维护：每次新增/删除/移动文件后更新本表。
> 更新: 2026-09-21 | 项目: dsh-switch-preset
> 2026-09-21 清理：移除 init 脚手架残留（MANUAL/prompts/语言模板/工程工具脚本/空壳占位/无效 ADR-001 与临时实例产物 test-home），实证归档 docs/05-testing/。

## 根目录

- README.md - 项目总览（v0.3.0：留在当前会话 + /list-preset + recompose 强制切换）
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

## src/（源码）

- src/index.ts - Host 入口（name/inject/VERSION/apply + settings 二次注入）
- src/host/switch.ts - 切换/列表纯逻辑（select / recompose 强制 / 降级默认，可单测）
- src/host/command.ts - 双命令注册 + ctx 服务组装（buildSwitchDeps 惰性解析 settings）
- src/host/types.ts - cordis Context 最小服务类型扩展
- src/client/entry.ts - Client 入口（ModuleLoader.load + 模式选择器注册）
- src/client/ui.ts - React 组件（模式选择器：中文名/描述弹层，h 函数式）
- src/shared/contracts.ts - 跨端契约（PresetRow/AgentPresetsLike/常量单一真源）

## test/（测试）

- test/smoke-test.mjs - 冒烟（产物/版本四处同步/导出完整性）
- test/switch-test.mjs - switch/list 纯逻辑 10 组单测（v1.2 矩阵：select/recompose/降级/报错链）

## scripts/（构建与安装）

- scripts/build.mjs - 双端 esbuild + 产物门禁（host 导出/命令名/client 无顶层 import/export + node --check）
- scripts/typecheck.mjs - 双 tsconfig --noEmit
- scripts/install-to-dsh.sh - 一键安装（强制显式 TARGET_DSH_HOME；构建→测试→link→验证）
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