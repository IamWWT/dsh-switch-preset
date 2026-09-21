#!/usr/bin/env bash
# ============================================================================
# cleanup-framework.sh — 把"整体拷贝的框架仓库"转正为独立项目
#
# 适用场景: 你用 cp -r 拷贝了整个框架目录并改名，准备当作新项目用。
# 框架自身带有与目标项目无关的元文档（示例/框架构建记录/框架经验），
# 本脚本把它们归档到 _framework-archive/（可恢复、不入库），并重建
# README.md / MEMORY.md / docs/FILE_INDEX.md，让新项目只留通用骨架。
#
# 用法:
#   scripts/cleanup-framework.sh [--name 项目名] [--fresh-git] [--dry-run]
#
# 说明:
#   - 只移动/重建，不删除；确认无误后手动删除 _framework-archive/
#   - --fresh-git 会删除 .git 并重新初始化（破坏性操作，需显式指定）
#   - AGENTS.md / standards / prompts / MANUAL.md 是通用协议，保留
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/project-lib.sh"

NAME=""
FRESH_GIT=0
DRY_RUN=0

while [ "$#" -gt 0 ]; do
    case "$1" in
        --name)
            if [ "$#" -lt 2 ]; then echo "错误: --name 需要值" >&2; exit 1; fi
            NAME="$2"; shift 2 ;;
        --fresh-git) FRESH_GIT=1; shift ;;
        --dry-run)   DRY_RUN=1; shift ;;
        -h|--help)
            echo "用法: scripts/cleanup-framework.sh [--name 项目名] [--fresh-git] [--dry-run]"
            exit 0 ;;
        --*) echo "错误: 未知参数 $1" >&2; exit 1 ;;
        *) echo "错误: 多余的位置参数 $1" >&2; exit 1 ;;
    esac
done

NAME="${NAME:-$(basename "$ROOT")}"
ARCHIVE="$ROOT/_framework-archive"

echo "== 清理框架元内容: $ROOT (项目名: $NAME) =="

# 1. 框架元内容清单（单一真源：与目标项目无关的文件）
META_FILES=(
    "docs/00-request/example-request.md"
    "docs/06-experience/lessons-from-opscrew.md"
)

echo "== 1/4 归档框架元内容 → _framework-archive/ =="
moved=0
for rel in "${META_FILES[@]}"; do
    src="$ROOT/$rel"
    if [ -f "$src" ]; then
        if [ "$DRY_RUN" -eq 1 ]; then
            echo "  [dry-run] 归档: $rel"
        else
            mkdir -p "$(dirname "$ARCHIVE/$rel")"
            mv "$src" "$ARCHIVE/$rel"
            echo "  归档: $rel"
        fi
        moved=$((moved + 1))
    fi
done
[ "$moved" -eq 0 ] && echo "  （无框架元内容，已是干净项目）"

if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$ARCHIVE"
    {
        echo "# _framework-archive — 框架元内容归档"
        echo ""
        echo "> 由 scripts/cleanup-framework.sh 归档。这些内容属于框架本身（示例/框架构建记录/框架经验），与目标项目无关，故移出 docs/。"
        echo "> 可随时恢复（mv 回原路径）；确认不需要后删除本目录。"
        echo ""
        echo "## 归档清单"
        for rel in "${META_FILES[@]}"; do
            [ -f "$ARCHIVE/$rel" ] && echo "- $rel"
        done
    } > "$ARCHIVE/README.md"
fi

echo "== 2/4 重建 README.md / MEMORY.md =="
if [ "$DRY_RUN" -eq 1 ]; then
    echo "  [dry-run] README.md / MEMORY.md 由模板重建"
else
    for tpl_name in README.md.tpl MEMORY.md.tpl; do
        tpl="$ROOT/scaffold/templates/$tpl_name"
        out="$ROOT/${tpl_name%.tpl}"
        content="$(<"$tpl")"
        content="${content//'{{PROJECT_NAME}}'/$NAME}"
        content="${content//'{{LANG}}'/}"
        content="${content//'{{DATE}}'/$(date +%Y-%m-%d)}"
        content="${content//'{{PROJECT_DESC}}'/（待补充：一句话说明项目做什么、给谁用）}"
        printf '%s\n' "$content" > "$out"
        echo "  重建: $(basename "$out")"
    done
fi

echo "== 3/4 重建 docs/FILE_INDEX.md =="
if [ "$DRY_RUN" -eq 1 ]; then
    echo "  [dry-run] docs/FILE_INDEX.md 重建"
else
    generate_file_index "$ROOT" "$NAME"
    echo "  重建: docs/FILE_INDEX.md"
fi

echo "== 4/4 验证 =="
if [ "$DRY_RUN" -eq 1 ]; then
    echo "  [dry-run] 跳过验证"
else
    if ! bash "$ROOT/scripts/doc-check.sh"; then
        echo ""
        echo "❌ doc-check 未通过：可能还有其他框架元内容未入清单，请按提示补充 META_FILES。" >&2
        exit 1
    fi
fi

if [ "$FRESH_GIT" -eq 1 ] && [ "$DRY_RUN" -eq 0 ]; then
    echo "== 重置 git 历史（--fresh-git）=="
    if [ -d "$ROOT/.git" ]; then
        rm -rf "$ROOT/.git"
        git -C "$ROOT" init -q
        git -C "$ROOT" add -A
        git -C "$ROOT" -c user.name="AI Framework" -c user.email="framework@local" commit -qm "chore: init $NAME (dsh-engineering-starter)"
        echo "  git 历史已重置"
    else
        echo "  （无 .git，跳过）"
    fi
fi

echo ""
echo "✅ 清理完成: $ROOT"
echo "  - 框架元内容已归档到 _framework-archive/（不入库，确认后手动删除）"
[ "$FRESH_GIT" -eq 1 ] && echo "  - git 历史已重置"
echo "  - 现在可在 DSH 工程模式会话中打开本项目，发送一句话需求"
