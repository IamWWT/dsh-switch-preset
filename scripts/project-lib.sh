#!/usr/bin/env bash
# ============================================================================
# project-lib.sh — 项目脚手架共用函数
# 被 scripts/init-project.sh 与 scripts/cleanup-framework.sh 引用（单一真源）
# ============================================================================

# instantiate_templates <scaffold_dir> <target_dir> <project_name> <lang> [kind_notes]
# 用 scaffold/templates/*.tpl 实例化占位符（{{PROJECT_NAME}}/{{LANG}}/{{DATE}}/{{PROJECT_DESC}}/{{KIND_NOTES}}）
instantiate_templates() {
    local scaffold="$1" target="$2" name="$3" lang="$4" kind_notes="${5:-}"
    local tpl out content
    for tpl in "$scaffold"/templates/*.tpl; do
        [ -e "$tpl" ] || continue
        out="$target/$(basename "${tpl%.tpl}")"
        content="$(<"$tpl")"
        content="${content//'{{PROJECT_NAME}}'/$name}"
        content="${content//'{{LANG}}'/$lang}"
        content="${content//'{{DATE}}'/$(date +%Y-%m-%d)}"
        content="${content//'{{PROJECT_DESC}}'/（待补充：一句话说明项目做什么、给谁用）}"
        content="${content//'{{KIND_NOTES}}'/$kind_notes}"
        printf '%s\n' "$content" > "$out"
        echo "  生成: $(basename "$out")"
    done
}

# generate_file_index <target_dir> <project_name> [kind]
# 重建 docs/FILE_INDEX.md（干净骨架，由 Agent 后续维护）
generate_file_index() {
    local target="$1" name="$2" kind="${3:-generic}"
    {
    cat <<EOF
---
title: FILE_INDEX - 文件索引
type: index
status: active
version: 1.0.0
date: $(date +%Y-%m-%d)
owner: AI + 维护人
applies_to: 项目文档
---

# FILE_INDEX - 文件索引

> 由 Agent 维护：每次新增/删除/移动文件后更新本表。
> 初始化: $(date +%Y-%m-%d) | 项目: $name

## 根目录

- README.md - 项目总览
- MANUAL.md - 使用手册（人先读）
- AGENTS.md - Agent 工作协议（单一入口）
- MEMORY.md - 当前状态/待办/硬约束
- LICENSE - Apache License 2.0
- .env.example - 环境变量示例

EOF
    if [ "$kind" = "dsh-plugin" ]; then
        cat <<EOF
- package.json - 插件清单（dsh 字段/双端 exports/构建脚本）
- tsconfig.json - Host 侧 TS 配置（Node，strict）
- tsconfig.client.json - Client 侧 TS 配置（浏览器）
- cordis.patch.yml - DSH bundle 补丁（config 层注入）
- test/ - 冒烟/单测/集成探针
EOF
    fi
    cat <<EOF

## docs/

- docs/FILE_INDEX.md - 本文件
- docs/README.md - 文档体系总览
- docs/glossary.md - 术语表
- docs/00-request/README.md - 需求摄入协议
EOF
    # 条件登记：example-request.md 被 cleanup-framework.sh 归档后不再列出
    if [ -f "$target/docs/00-request/example-request.md" ]; then
        echo "- docs/00-request/example-request.md - 需求摄入示例"
    fi
    if [ "$kind" = "dsh-plugin" ]; then
        cat <<EOF
- docs/specs/README.md - SDD 规格目录说明（三件套：spec→plan→tasks）
- docs/specs/_template/ - SDD 三件套模板
EOF
    fi
    cat <<EOF
- docs/01-requirements/prd-template.md - PRD 模板
- docs/02-design/architecture-template.md - 架构模板
- docs/02-design/decisions/README.md - ADR 规范
- docs/02-design/decisions/adr-template.md - ADR 模板
- docs/03-plan/tasks-template.md - 任务计划模板
- docs/04-progress/README.md - 进度日志规范
- docs/05-testing/README.md - 测试报告规范
- docs/06-experience/README.md - 经验库规范
- docs/07-ops/README.md - 运行手册规范

## standards/ + scripts/

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
- standards/enterprise/README.md - 企业规范（收纳/导入/优先级）
- standards/languages/java.md - Java 适配
- standards/languages/python.md - Python 适配
- standards/languages/rust.md - Rust 适配
- standards/languages/go.md - Go 适配
- standards/languages/node.md - TypeScript/Node 适配
- scripts/doc-check.sh - 文档一致性检查
- scripts/quality-gate.sh - 质量门禁
- scripts/journal.sh - 进度日志
- scripts/experience.sh - 经验记录
- scripts/init-project.sh - 项目初始化
- scripts/cleanup-framework.sh - 框架拷贝转正（归档元内容）
- scripts/handoff.sh - 会话交接单更新
- scaffold/README.md - 脚手架说明（支持嵌套初始化）
EOF
    if [ "$kind" = "dsh-plugin" ]; then
        cat <<EOF

## dsh-plugin 专属

- scripts/build.mjs - 双端构建 + 产物门禁（三职责不得弱化）
- scripts/typecheck.mjs - 双 tsconfig --noEmit
- scripts/install-to-dsh.sh - 一键安装（构建→冒烟→安装→验证，幂等）
- test/smoke-test.mjs - 冒烟测试
- src/index.ts - Host 入口（name/inject/VERSION/apply，具名导出）
- src/client/entry.ts - Client 入口（window.__ModuleLoader__ 注册）
- src/shared/ - Host/Client 共享契约（单一真源）
EOF
    fi
    cat <<EOF

## scaffold/kinds/dsh-plugin/（生成模板，随项目携带以支持嵌套 init；generic 项目可忽略）

- scaffold/kinds/dsh-plugin/KIND_NOTES.md - dsh-plugin 追加纪律（实例化进 AGENTS.md）
- scaffold/kinds/dsh-plugin/docs/specs/README.md - SDD 规格目录说明（模板）
- scaffold/kinds/dsh-plugin/docs/specs/_template/README.md - SDD 三件套模板说明
- scaffold/kinds/dsh-plugin/docs/specs/_template/spec.md - SDD spec 模板
- scaffold/kinds/dsh-plugin/docs/specs/_template/plan.md - SDD plan 模板
- scaffold/kinds/dsh-plugin/docs/specs/_template/tasks.md - SDD tasks 模板
EOF
    cat <<EOF

## prompts/

- prompts/README.md - 一句话指令用法
- prompts/new-project.md - 新项目模板
- prompts/import-standards.md - 导入企业规范
- prompts/feature.md - 新功能指令
- prompts/bugfix.md - Bug 修复指令
- prompts/review.md - 评审指令
- prompts/report.md - 复盘报告指令

## 源码

- src/ - 源码
- tests/ - 测试
EOF
    } > "$target/docs/FILE_INDEX.md"
}