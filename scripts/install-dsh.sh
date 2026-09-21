#!/usr/bin/env bash
# ============================================================================
# install-dsh.sh — 把 dsh-engineering-starter 装入 DSH（DeepSeek Harness）
#
# 装入内容：
#   1. agent preset：presets/engineering/ → $DSH_HOME/.agent-presets/engineering/
#      （agent.cordis.yml + preset.yml；DSH 每次读 roster 时重新发现，无需重启）
#   2. 随包 skills：presets/engineering/skills/（grill-me/grilling/project-discipline）
#      随 preset 一起复制、由 preset 的 skill-filesystem 行以 preset 层（scoped）
#      注册——工程模式内 shadow 全局同名技能，模式外不影响。★ 因此本脚本
#      不再改动 $HOME/.agents/skills（用户的全局技能根）任何内容（2026-09-14）。
#
# 用法:
#   scripts/install-dsh.sh                  # 安装（幂等；覆盖前自动备份）
#   scripts/install-dsh.sh --dsh-home DIR   # 指定 DSH home（默认 $DSH_HOME 或 ~/.dsh-dev）
#   scripts/install-dsh.sh --uninstall      # 移除 preset（skills 随 preset 移除，不碰全局技能根）
#
# 说明:
#   - 已有同名 preset 会先备份为 engineering.bak-<时间戳>，可手动比对/回滚。
#   - 安装后新开一个 DSH 会话（选择"工程模式"preset）即可生效；
#     正在运行的会话保持旧 persona，不需要也不应该重启 3082。
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRESET_SRC="$ROOT/presets/engineering"

DSH_HOME="${DSH_HOME:-$HOME/.dsh-dev}"
MODE="install"

while [ "$#" -gt 0 ]; do
    case "$1" in
        --dsh-home)   [ "$#" -ge 2 ] || { echo "错误: --dsh-home 需要值" >&2; exit 1; }; DSH_HOME="$2"; shift 2 ;;
        --uninstall)  MODE="uninstall"; shift ;;
        -h|--help)    grep '^#' "$0" | sed 's/^# \{0,1\}//' ; exit 0 ;;
        *) echo "错误: 未知参数 $1（见 --help）" >&2; exit 1 ;;
    esac
done

TS="$(date +%Y%m%d-%H%M%S)"

echo "== dsh-engineering-starter 安装 (mode=$MODE) =="
echo "  DSH_HOME = $DSH_HOME"

if [ "$MODE" = "uninstall" ]; then
    PRESET_DST="$DSH_HOME/.agent-presets/engineering"
    if [ -e "$PRESET_DST" ]; then
        mv "$PRESET_DST" "${PRESET_DST}.bak-$TS"
        echo "  移除 preset: engineering → .bak-$TS"
    else
        echo "  preset 不存在，跳过"
    fi
    echo "✅ 卸载完成（被移除项均已保留为 .bak-$TS，确认无用后可删除）"
    echo "   注：本脚本不动全局技能根 ~/.agents/skills；如曾装过旧版 skills，可自行清理对应 .bak。"
    exit 0
fi

# ---- 1. preset（含随包 skills）----
[ -d "$PRESET_SRC" ] || { echo "错误: 缺少 $PRESET_SRC" >&2; exit 1; }
[ -f "$PRESET_SRC/agent.cordis.yml" ] || { echo "错误: preset 缺少 agent.cordis.yml" >&2; exit 1; }
echo "== 1/1 agent preset（含 skills/）→ $DSH_HOME/.agent-presets/engineering =="
PRESET_DST="$DSH_HOME/.agent-presets/engineering"
if [ -e "$PRESET_DST" ]; then
    mv "$PRESET_DST" "$PRESET_DST.bak-$TS"
    echo "  备份: engineering → engineering.bak-$TS"
fi
mkdir -p "$PRESET_DST"
cp -r "$PRESET_SRC/." "$PRESET_DST/"
echo "  安装: $PRESET_DST（agent.cordis.yml + preset.yml + skills/）"

echo ""
echo "✅ 安装完成。"
echo "  - 新会话选择『工程模式』preset 即生效（DSH 每次读 roster 重新发现，无需重启）。"
echo "  - 随包 skills（grill-me/grilling/project-discipline）以 preset 层注册，工程模式内 shadow 全局；"
echo "    用户全局技能根 ~/.agents/skills 未被改动，原版 grill-me 等原样保留。"
echo "  - 已运行的会话不受影响。"
echo "  - 回滚: 删除新目录并把 .bak-$TS 改回原名即可。"