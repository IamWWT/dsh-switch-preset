#!/usr/bin/env bash
# ============================================================================
# doc-check.sh — 文档一致性检查
# 检查项:
#   1. FILE_INDEX.md 是否覆盖所有 markdown 文档
#   2. markdown 相对链接是否断裂
#   3. 非模板文件是否存在未替换的 {{...}} 占位符
# 退出码: 0 = 通过; 1 = 存在问题
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INDEX="$ROOT/docs/FILE_INDEX.md"

errors=0
warnings=0

say_err()   { echo "  [ERROR] $1"; errors=$((errors + 1)); }
say_warn()  { echo "  [WARN]  $1"; warnings=$((warnings + 1)); }
say_ok()    { echo "  [OK]    $1"; }

echo "== 1. FILE_INDEX 覆盖检查 =="
if [ ! -f "$INDEX" ]; then
    say_err "缺少 docs/FILE_INDEX.md"
else
    while IFS= read -r -d '' f; do
        rel="${f#"$ROOT"/}"
        # FILE_INDEX 自身无需列出自己
        [ "$rel" = "docs/FILE_INDEX.md" ] && continue
        case "$rel" in
            .git/*|projects/*|node_modules/*) continue ;;
        esac
        if ! grep -Fq "$rel" "$INDEX"; then
            say_err "FILE_INDEX.md 未收录: $rel"
        fi
    done < <(find "$ROOT" -name '*.md' -not -path "$ROOT/_framework-archive/*" -not -path "$ROOT/node_modules/*" -print0)
fi

echo "== 2. 相对链接检查 =="
while IFS= read -r -d '' f; do
    dir="$(dirname "$f")"
    # 仅检查围栏外且非行内代码的内容（awk 跳围栏, sed 先剔双反引号跨度再剔单反引号跨度）
    links="$(awk 'BEGIN{in_fence=0} /^```/{in_fence=!in_fence; next} !in_fence{print}' "$f" \
        | sed -E 's/``[^`]*``//g; s/`[^`]*`//g' \
        | grep -oE '\]\([^)]*\)' 2>/dev/null \
        | sed -E 's/^\]\(//; s/\)$//')"
    [ -z "$links" ] && continue
    while IFS= read -r link; do
        [ -z "$link" ] && continue
        case "$link" in
            http://*|https://*|mailto:*|/*|\#*) continue ;;
            '<'*) continue ;;
        esac
        # 去掉锚点 #xxx 后判断路径
        target="${link%%#*}"
        [ -z "$target" ] && continue
        if [ ! -e "$dir/$target" ]; then
            rel="${f#"$ROOT"/}"
            say_err "断链: $rel -> $target"
        fi
    done <<< "$links"
done < <(find "$ROOT" -name '*.md' -not -path "$ROOT/_framework-archive/*" -not -path "$ROOT/node_modules/*" -print0)

echo "== 3. 占位符检查（{{...}}）=="
while IFS= read -r -d '' f; do
    rel="${f#"$ROOT"/}"
    case "$rel" in
        *-template.md|scaffold/*|prompts/*|docs/specs/_template/*) continue ;;
        # 以下文件内含"模板示例区"，占位符是有意保留的
        docs/05-testing/README.md|docs/06-experience/README.md) continue ;;
        standards/documentation.md) continue ;;  # 本文描述占位符规则本身
    esac
    if grep -qE '\{\{' "$f" 2>/dev/null; then
        say_err "存在未替换占位符 {{...}}: $rel"
    fi
done < <(find "$ROOT" -name '*.md' -not -path "$ROOT/_framework-archive/*" -not -path "$ROOT/node_modules/*" -print0)

echo "== 4. Frontmatter 检查（正式文档）=="
while IFS= read -r -d '' f; do
    rel="${f#"$ROOT"/}"
    case "$rel" in
        # 流水账（进度/经验条目）与指令/脚手架说明豁免
        docs/04-progress/*|docs/06-experience/*) continue ;;
        prompts/*|scaffold/*) continue ;;
    esac
    case "$rel" in
        docs/*|standards/*)
            first="$(head -1 "$f")"
            if [ "$first" != "---" ]; then
                say_err "缺少 frontmatter（首行应为 ---）: $rel"
            else
                missing=""
                for key in "title:" "type:" "status:" "version:" "date:"; do
                    if ! grep -q "^$key" "$f"; then missing="$missing $key"; fi
                done
                if [ -n "$missing" ]; then say_err "frontmatter 缺字段$missing: $rel"; fi
            fi ;;
    esac
done < <(find "$ROOT" -name '*.md' -not -path "$ROOT/_framework-archive/*" -not -path "$ROOT/node_modules/*" -print0)

echo ""
echo "== 5. system prompt 体量检查（铁律 16）=="
# AGENTS.md 是 Agent 的常驻入口，过厚会持续挤占上下文/预算；
# preset persona 同理（本检查只覆盖本仓库内可测的文件）。
AGENTS_MAX_BYTES=16384   # ≈ 4K tokens（中英混排）；超过即提醒拆分到按需加载的文件
if [ -f "$ROOT/AGENTS.md" ]; then
    size=$(wc -c < "$ROOT/AGENTS.md")
    if [ "$size" -gt "$AGENTS_MAX_BYTES" ]; then
        say_warn "AGENTS.md 达 ${size}B（> ${AGENTS_MAX_BYTES}B）：常驻入口应薄，重内容移到按需加载的文件（铁律 16）"
    else
        say_ok "AGENTS.md 体量 ${size}B（≤ ${AGENTS_MAX_BYTES}B）"
    fi
fi

echo ""
echo "结果: $errors 个错误, $warnings 个警告"
[ "$errors" -eq 0 ] && echo "✅ doc-check 通过" || echo "❌ doc-check 未通过"
exit "$([ "$errors" -eq 0 ] && echo 0 || echo 1)"
