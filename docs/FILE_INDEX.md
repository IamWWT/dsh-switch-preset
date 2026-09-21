---
title: FILE_INDEX - 文件索引
type: index
status: active
version: 1.1.0
date: 2026-09-17
owner: AI + 维护人
applies_to: dsh-switch-preset
---

# FILE_INDEX - 文件索引

> 由 Agent 维护：每次新增/删除/移动文件后更新本表。
> 更新: 2026-09-17 | 项目: dsh-switch-preset

## 根目录

- README.md - 项目总览（v0.2.0 行为：留在当前会话 + /list-preset）
- MANUAL.md - 使用手册（人先读）
- AGENTS.md - Agent 工作协议（单一入口）
- MEMORY.md - 当前状态/待办/硬约束
- LICENSE - Apache License 2.0
- .env.example - 环境变量示例
- .gitignore - 忽略规则（含 .npm-cache/、lib/、lib-test/、test-home/）
- package.json - 插件清单（dsh 字段/双端 exports/构建脚本）
- tsconfig.json - Host 侧 TS 配置（Node，strict）
- tsconfig.client.json - Client 侧 TS 配置（浏览器）
- cordis.patch.yml - DSH bundle 补丁（insert 实例化行；空数组不加载）
- CHANGELOG.md - 版本变更记录
- test-home/ - 临时实例产物（3084 验证留档，可整体删除）

## docs/

- docs/FILE_INDEX.md - 本文件
- docs/README.md - 文档体系总览
- docs/glossary.md - 术语表
- docs/REQUIREMENTS.md - 需求演进单一事实源
- docs/TROUBLESHOOTING.md - 排障记录（现象→根因→修复→预防 + DSH API 基线）
- docs/00-request/README.md - 需求摄入协议
- docs/00-request/request.md - 需求摄入正式版（目标锚定/澄清记录/假设表）
- docs/00-request/example-request.md - 需求摄入示例
- docs/01-requirements/prd.md - PRD 正式版（F-01~F-08 + NFR）
- docs/01-requirements/prd-template.md - PRD 模板
- docs/02-design/architecture.md - 架构设计 v3.0.0（边界/状态模型/调用链图/注入清单/框架边界）
- docs/02-design/architecture-template.md - 架构模板
- docs/02-design/switch-preset-flow.mmd - 切换调用链 mermaid 源码（mmdc 渲染）
- docs/02-design/switch-preset-flow.png - 调用链图导出（150KB，PowerPoint/文档引用）
- docs/02-design/decisions/README.md - ADR 规范
- docs/02-design/decisions/adr-001-fork-create.md - ADR-001（复用 create/fork 实现切换）
- docs/02-design/decisions/adr-template.md - ADR 模板
- docs/03-plan/tasks-template.md - 任务计划模板
- docs/04-progress/README.md - 进度日志规范
- docs/04-progress/PROGRESS.md - 进度真源（✅/🔄/⏭）
- docs/04-progress/SESSION.md - 会话交接单（新会话先读）
- docs/05-testing/README.md - 测试报告规范
- docs/06-experience/README.md - 经验库规范
- docs/07-ops/README.md - 运行手册规范
- docs/specs/README.md - SDD 规格目录说明（三件套：spec→plan→tasks）
- docs/specs/001-switch-preset/spec.md - 规格 001（AC-1~AC-11，用户已确认）
- docs/specs/001-switch-preset/plan.md - 技术规划 001
- docs/specs/001-switch-preset/tasks.md - 任务拆解 001（T1~T6）
- docs/specs/_template/README.md - SDD 三件套模板说明
- docs/specs/_template/spec.md - SDD spec 模板
- docs/specs/_template/plan.md - SDD plan 模板
- docs/specs/_template/tasks.md - SDD tasks 模板

## src/（源码）

- src/index.ts - Host 入口（name/inject/VERSION/Config schema/apply）
- src/host/switch.ts - 切换/列表核心纯逻辑（就地 select / 降级写默认模式，可单测）
- src/host/command.ts - 命令注册 + ctx 服务组装（buildSwitchDeps 单点适配）
- src/host/types.ts - cordis Context 最小服务类型扩展
- src/client/entry.ts - Client 入口（ModuleLoader.load + 模式选择器注册）
- src/client/ui.ts - React 组件（模式选择器：中文名/描述弹层，h 函数式）
- src/shared/contracts.ts - 跨端契约（PresetRow/SwitchDeps/文本格式/设置键单一真源）

## test/（测试）

- test/smoke-test.mjs - 冒烟（产物/版本四处同步/导出完整性）
- test/switch-test.mjs - switch/list 纯逻辑 8 组单测（v1.1 矩阵）

## scripts/（构建与安装）

- scripts/build.mjs - 双端 esbuild + 产物门禁（host 导出/命令名/client 插槽断言）
- scripts/typecheck.mjs - 双 tsconfig --noEmit
- scripts/install-to-dsh.sh - 一键安装（强制显式 TARGET_DSH_HOME；构建→测试→link→验证）
- scripts/doc-check.sh - 文档一致性检查（工程工具）
- scripts/quality-gate.sh - 质量门禁（工程工具）
- scripts/journal.sh - 进度日志（工程工具）
- scripts/experience.sh - 经验记录（工程工具）
- scripts/handoff.sh - 会话交接单更新（工程工具）
- scripts/init-project.sh - 项目初始化（工程工具）
- scripts/install-dsh.sh - dsh 安装（工程工具）
- scripts/cleanup-framework.sh - 框架拷贝转正（工程工具）
- scripts/project-lib.sh - 工程工具公共库

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
- standards/languages/java.md - Java 适配
- standards/languages/python.md - Python 适配
- standards/languages/rust.md - Rust 适配
- standards/languages/go.md - Go 适配
- standards/languages/node.md - TypeScript/Node 适配

## prompts/（指令模板）

- prompts/README.md - 一句话指令用法
- prompts/new-project.md - 新项目模板
- prompts/import-standards.md - 导入企业规范
- prompts/feature.md - 新功能指令
- prompts/bugfix.md - Bug 修复指令
- prompts/review.md - 评审指令
- prompts/report.md - 复盘报告指令