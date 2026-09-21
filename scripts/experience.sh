#!/usr/bin/env bash
# ============================================================================
# experience.sh — 追加经验条目到 docs/06-experience/
# 用法:
#   scripts/experience.sh "主题" "场景" "问题" "根因" "解决"
#   scripts/experience.sh --list      # 列出已有经验文件
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/docs/06-experience"
mkdir -p "$DIR"

if [ "${1:-}" = "--list" ]; then
    ls -1 "$DIR" | sort -r
    exit 0
fi

if [ "$#" -lt 5 ]; then
    cat >&2 <<'EOF'
用法: scripts/experience.sh "主题" "场景" "问题" "根因" "解决"
  或: scripts/experience.sh --list
EOF
    exit 1
fi

TITLE="$1"; SCENE="$2"; PROBLEM="$3"; ROOT_CAUSE="$4"; SOLUTION="$5"
DATE="$(date +%Y-%m-%d)"
FILE="$DIR/$DATE.md"

{
    echo ""
    echo "## $DATE $TITLE"
    echo ""
    echo "- **场景**: $SCENE"
    echo "- **问题**: $PROBLEM"
    echo "- **根因**: $ROOT_CAUSE"
    echo "- **解决**: $SOLUTION"
    echo "- **适用范围**: （待补：适用于哪些项目类型）"
} >> "$FILE"

echo "已追加: $FILE"

# 新文件自动登记 FILE_INDEX（文档纪律：文件变化必须更新索引）
INDEX="$ROOT/docs/FILE_INDEX.md"
INDEX_LINE="docs/06-experience/$DATE.md"
if [ -f "$INDEX" ] && ! grep -Fq "$INDEX_LINE" "$INDEX"; then
    echo "- $INDEX_LINE - 经验条目" >> "$INDEX"
    echo "（已登记 docs/FILE_INDEX.md）"
fi
