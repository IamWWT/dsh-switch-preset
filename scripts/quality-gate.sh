#!/usr/bin/env bash
# ============================================================================
# quality-gate.sh — 质量门禁（交付/里程碑前必须全绿）
#   1. 脚本语法检查 (bash -n)
#   2. 文档一致性检查 (doc-check.sh)
#   3. 语言构建与测试（自动探测, 可用 --skip-build 跳过）
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_BUILD="${SKIP_BUILD:-0}"
[ "${1:-}" = "--skip-build" ] && SKIP_BUILD=1

fail=0

echo "== 1/3 脚本语法检查 =="
for s in "$ROOT"/scripts/*.sh; do
    if bash -n "$s"; then
        echo "  [OK] $(basename "$s")"
    else
        echo "  [ERROR] $(basename "$s") 语法错误"
        fail=1
    fi
done

echo ""
echo "== 2/3 文档一致性检查 =="
if ! "$ROOT/scripts/doc-check.sh"; then
    fail=1
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
    echo ""
    echo "== 3/3 构建与测试（自动探测）=="
    cd "$ROOT"
    if [ -f pom.xml ]; then
        if command -v mvn >/dev/null 2>&1; then
            echo "  [探测] Maven 项目"
            mvn -q clean verify || fail=1
        else
            echo "  [WARN] 检测到 pom.xml 但未安装 mvn，跳过构建"
        fi
    elif [ -f Cargo.toml ]; then
        if command -v cargo >/dev/null 2>&1; then
            echo "  [探测] Rust 项目"
            cargo test --quiet || fail=1
        else
            echo "  [WARN] 检测到 Cargo.toml 但未安装 cargo，跳过构建"
        fi
    elif [ -f go.mod ]; then
        if command -v go >/dev/null 2>&1; then
            echo "  [探测] Go 项目"
            go build ./... && go test ./... || fail=1
        else
            echo "  [WARN] 检测到 go.mod 但未安装 go，跳过构建"
        fi
    elif [ -f package.json ]; then
        if command -v npm >/dev/null 2>&1; then
            echo "  [探测] Node 项目"
            npm test || fail=1
        else
            echo "  [WARN] 检测到 package.json 但未安装 npm，跳过构建"
        fi
    elif [ -f pyproject.toml ]; then
        echo "  [探测] Python 项目"
        if command -v uv >/dev/null 2>&1; then uv run pytest -q || fail=1
        elif command -v pytest >/dev/null 2>&1; then pytest -q || fail=1
        else echo "  [WARN] 检测到 pyproject.toml 但未安装 uv/pytest，跳过测试"; fi
    else
        echo "  [INFO] 未探测到项目构建文件，跳过构建测试"
    fi
else
    echo ""
    echo "== 3/3 跳过构建与测试（--skip-build）=="
fi

echo ""
if [ "$fail" -eq 0 ]; then
    echo "✅ quality-gate 全绿"
else
    echo "❌ quality-gate 未通过，修复后重跑"
fi
exit "$fail"
