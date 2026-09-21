#!/usr/bin/env bash
# ============================================================================
# journal.sh — 追加进度日志到 docs/04-progress/
# 用法:
#   scripts/journal.sh "本批做了什么..."
#   scripts/journal.sh --subject "阶段名" "做了什么..."
#   scripts/journal.sh --list          # 列出已有日志
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/docs/04-progress"
mkdir -p "$DIR"

if [ "${1:-}" = "--list" ]; then
    ls -1 "$DIR" | sort -r
    exit 0
fi

SUBJECT=""
if [ "${1:-}" = "--subject" ]; then
    SUBJECT="$2"
    shift 2
fi

MSG="${1:-}"
if [ -z "$MSG" ]; then
    echo "用法: scripts/journal.sh [--subject 阶段名] \"日志内容\"" >&2
    exit 1
fi

DATE="$(date +%Y-%m-%d)"
FILE="$DIR/$DATE.md"

if [ ! -f "$FILE" ]; then
    {
        echo "# $DATE 进度日志"
        if [ -n "$SUBJECT" ]; then echo ""; echo "## $SUBJECT"; fi
        echo ""
    } > "$FILE"
else
    if [ -n "$SUBJECT" ]; then
        { echo ""; echo "## $SUBJECT"; echo ""; } >> "$FILE"
    else
        echo "" >> "$FILE"
    fi
fi

echo "- $(date +%H:%M) $MSG" >> "$FILE"
echo "已追加: $FILE"

# 新文件自动登记 FILE_INDEX（文档纪律：文件变化必须更新索引）
INDEX="$ROOT/docs/FILE_INDEX.md"
INDEX_LINE="docs/04-progress/$DATE.md"
if [ -f "$INDEX" ] && ! grep -Fq "$INDEX_LINE" "$INDEX"; then
    echo "- $INDEX_LINE - 进度日志" >> "$INDEX"
    echo "（已登记 docs/FILE_INDEX.md）"
fi
