#!/usr/bin/env bash
# ============================================================================
# install-to-dsh.sh — dsh-switch-preset 一键安装（构建→冒烟→安装→验证），幂等可重跑
#
# 红线（PLUGIN-DEV-STANDARD §7）：
#   - 未经验证的改动禁止装生产实例；本脚本要求显式给出目标 DSH_HOME，
#     未显式指定时拒绝执行（防误装 3082 生产）。
#   - 开发期用源码 link 安装；tgz 仅用于稳定版（每次重打包必升版本号）。
#   - 装到临时实例：TARGET_DSH_HOME=<测试 home> HARNESS_DIR=<测试 harness 目录> scripts/install-to-dsh.sh
#   - 安装后重启目标实例须另行执行（本脚本不自动重启）。
#
# 用法：
#   TARGET_DSH_HOME=$HOME/.dsh-switch-preset-test scripts/install-to-dsh.sh
#     （HARNESS_DIR 未指定时默认指向工作区主 harness deepseek-harness/）
# ============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> [1/4] 构建 + 产物门禁 + 全部测试"
node "$ROOT/scripts/build.mjs"
node "$ROOT/test/smoke-test.mjs"
node "$ROOT/test/switch-test.mjs"
node "$ROOT/test/session-jump-test.mjs"

export DSH_HOME_TARGET="${TARGET_DSH_HOME:-}"
if [ -z "$DSH_HOME_TARGET" ]; then
  echo "错误: 未指定目标 DSH_HOME（防误装生产）。用法: TARGET_DSH_HOME=<dir> $0" >&2
  exit 1
fi
# shellcheck source=./paths.sh
source "$(dirname "${BASH_SOURCE[0]}")/paths.sh"
HARNESS_DIR="${HARNESS_DIR:-${DSH_HARNESS_ROOT:-$(dsh_resolve_harness "$ROOT")}}"
[ -n "$HARNESS_DIR" ] && [ -d "$HARNESS_DIR" ] || { dsh_harness_error; exit 1; }
echo "==> [2/4] 目标 DSH_HOME: $DSH_HOME_TARGET"
[ -d "$DSH_HOME_TARGET" ] || { echo "错误: $DSH_HOME_TARGET 不存在（临时实例请先用 pnpm dsh web 初始化一次）" >&2; exit 1; }

echo "==> [3/4] 安装（源码 link 到目标 profile web）"
(cd "$HARNESS_DIR" && DSH_HOME="$DSH_HOME_TARGET" pnpm dsh plugin --profile web add "$ROOT") || {
  echo "错误: plugin add 失败（检查 HARNESS_DIR=$HARNESS_DIR 与 DSH_HOME 目标是否可写）" >&2
  exit 1
}

echo "==> [4/4] 安装后验证"
node -e "
const fs = require('node:fs');
const home = process.env.DSH_HOME_TARGET;
const pkgPath = home + '/profiles/web/node_modules/dsh-switch-preset';
const ok = fs.existsSync(pkgPath + '/lib/index.js') && fs.existsSync(pkgPath + '/lib/client.js');
console.log(ok ? '  PASS  安装目录布局（lib/index.js + lib/client.js）' : '  FAIL  安装目录布局缺失');
process.exit(ok ? 0 : 1);
"