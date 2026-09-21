#!/usr/bin/env bash
# ============================================================================
# handoff.sh — 会话交接单（跨会话恢复机制）
# 每次会话结束前更新 docs/04-progress/SESSION.md，让新会话的 Agent
# 打开目录后能立即知道"上次做到哪、下一步做什么"。
#
# 用法:
#   scripts/handoff.sh [--session "2026-08-02 14:00-18:00"] \
#                      [--target "本次会话目标"] [--done "完成情况（含失败）"] \
#                      [--evidence "验证证据位置"] [--blocker "阻塞/待确认"] \
#                      [--next "下一步任务，如 T-04"]
#   scripts/handoff.sh --show        # 查看当前交接单
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="$ROOT/docs/04-progress/SESSION.md"

SESSION=""; TARGET=""; DONE=""; EVIDENCE=""; BLOCKER=""; NEXT=""

if [ "${1:-}" = "--show" ]; then
    [ -f "$FILE" ] && cat "$FILE" || echo "（尚无交接单：$FILE）"
    exit 0
fi

while [ "$#" -gt 0 ]; do
    case "$1" in
        --session)  SESSION="$2"; shift 2 ;;
        --target)   TARGET="$2"; shift 2 ;;
        --done)     DONE="$2"; shift 2 ;;
        --evidence) EVIDENCE="$2"; shift 2 ;;
        --blocker)  BLOCKER="$2"; shift 2 ;;
        --next)     NEXT="$2"; shift 2 ;;
        -h|--help)
            echo "用法: scripts/handoff.sh [--session ..] [--target ..] [--done ..] [--evidence ..] [--blocker ..] [--next ..]"
            exit 0 ;;
        --*) echo "错误: 未知参数 $1" >&2; exit 1 ;;
        *)  echo "错误: 多余的位置参数 $1" >&2; exit 1 ;;
    esac
done

mkdir -p "$(dirname "$FILE")"
cat > "$FILE" <<EOF
# SESSION — 会话交接单

> 只保留最近一次会话的交接信息；每次会话结束必须覆盖更新。
> 新会话启动协议见 AGENTS.md §3.1；长期权威源 MEMORY.md，过程事实源 docs/04-progress/。

## 上次会话

- 时间: ${SESSION:-（待补）}
- 会话目标: ${TARGET:-（待补）}
- 完成情况: ${DONE:-（待补）}
- 验证证据: ${EVIDENCE:-（待补）}

## 未完成与阻塞

- ${BLOCKER:-（待补）}

## 下一步

- 任务: ${NEXT:-（待补）}
- 需要用户先做的事: （待补）

## 未落盘的约定

- （待补）
EOF

echo "已更新: $FILE"

# 新文件自动登记 FILE_INDEX（文档纪律：文件变化必须更新索引）
INDEX="$ROOT/docs/FILE_INDEX.md"
if [ -f "$INDEX" ] && ! grep -Fq "docs/04-progress/SESSION.md" "$INDEX"; then
    echo "- docs/04-progress/SESSION.md - 会话交接单（跨会话恢复）" >> "$INDEX"
    echo "（已登记 docs/FILE_INDEX.md）"
fi

echo ""
echo "提示: 请同步更新 MEMORY.md（当前状态/待办）与 docs/04-progress/ 当日日志。"
