#!/usr/bin/env bash
# ============================================================================
# init-project.sh — 从框架脚手架生成新项目
# 用法:
#   scripts/init-project.sh <目标目录> [--lang java|python|rust|go|node] \
#                           [--kind generic|dsh-plugin] [--name "项目名"] [--git]
#
# --kind:
#   generic     普通应用（默认）
#   dsh-plugin  DSH 插件（生成 package.json dsh 字段/双 tsconfig/build.mjs
#               产物门禁/冒烟测试/docs/specs SDD 骨架；--lang 缺省为 node）
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAFFOLD="$ROOT/scaffold"
source "$ROOT/scripts/project-lib.sh"

TARGET=""
LANG=""
NAME=""
KIND="generic"
INIT_GIT=0

while [ "$#" -gt 0 ]; do
    case "$1" in
        --lang)
            if [ "$#" -lt 2 ]; then echo "错误: --lang 需要值 (java|python|rust|go|node)" >&2; exit 1; fi
            LANG="$2"; shift 2 ;;
        --kind)
            if [ "$#" -lt 2 ]; then echo "错误: --kind 需要值 (generic|dsh-plugin)" >&2; exit 1; fi
            KIND="$2"; shift 2 ;;
        --name)
            if [ "$#" -lt 2 ]; then echo "错误: --name 需要值" >&2; exit 1; fi
            NAME="$2"; shift 2 ;;
        --git)  INIT_GIT=1; shift ;;
        -h|--help)
            echo "用法: scripts/init-project.sh <目标目录> [--lang java|python|rust|go|node] [--kind generic|dsh-plugin] [--name 项目名] [--git]"
            exit 0 ;;
        --*) echo "错误: 未知参数 $1" >&2; exit 1 ;;
        *)
            if [ -n "$TARGET" ]; then echo "错误: 多余的位置参数 $1" >&2; exit 1; fi
            TARGET="$1"; shift ;;
    esac
done

if [ -z "$TARGET" ]; then
    echo "错误: 缺少目标目录" >&2
    echo "用法: scripts/init-project.sh <目标目录> [--lang ...] [--kind generic|dsh-plugin] [--name ...] [--git]" >&2
    exit 1
fi
case "$KIND" in
    generic|dsh-plugin) : ;;
    *) echo "错误: --kind 仅支持 generic|dsh-plugin（收到: $KIND）" >&2; exit 1 ;;
esac

if [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    echo "错误: 目标目录非空: $TARGET" >&2
    exit 1
fi
if [ -e "$TARGET" ] && [ ! -d "$TARGET" ]; then
    echo "错误: 目标路径已存在且不是目录: $TARGET" >&2
    exit 1
fi

mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
NAME="${NAME:-$(basename "$TARGET")}"
if [ "$KIND" = "dsh-plugin" ] && [ -z "$LANG" ]; then LANG="node"; fi

echo "== 初始化项目: $TARGET (名称: $NAME, 语言: ${LANG:-未指定}, 类型: $KIND) =="

# 1. 模板文件（占位符替换，见 project-lib.sh）
KIND_NOTES=""
if [ "$KIND" = "dsh-plugin" ] && [ -f "$SCAFFOLD/kinds/dsh-plugin/KIND_NOTES.md" ]; then
    KIND_NOTES="$(cat "$SCAFFOLD/kinds/dsh-plugin/KIND_NOTES.md")"
fi
instantiate_templates "$SCAFFOLD" "$TARGET" "$NAME" "$LANG" "$KIND_NOTES"
for f in "$SCAFFOLD"/templates/.*; do
    case "$(basename "$f")" in
        .|..) continue ;;
        *.tpl) continue ;;
        *) cp "$f" "$TARGET/" && echo "  复制: $(basename "$f")" ;;
    esac
done
cp "$ROOT/MANUAL.md" "$TARGET/MANUAL.md"
echo "  生成: MANUAL.md"
cp "$ROOT/LICENSE" "$TARGET/LICENSE"
echo "  复制: LICENSE"

# 2. 文档骨架
DOCS=(
    "00-request" "01-requirements" "02-design/decisions" "03-plan"
    "04-progress" "05-testing" "06-experience" "07-ops"
)
for d in "${DOCS[@]}"; do mkdir -p "$TARGET/docs/$d"; done

cp "$ROOT/docs/00-request/README.md" "$ROOT/docs/00-request/example-request.md" "$TARGET/docs/00-request/"
cp "$ROOT/docs/README.md" "$ROOT/docs/glossary.md" "$TARGET/docs/"
cp "$ROOT/docs/01-requirements/prd-template.md" "$TARGET/docs/01-requirements/"
cp "$ROOT/docs/02-design/architecture-template.md" "$TARGET/docs/02-design/"
cp "$ROOT/docs/02-design/decisions/README.md" "$ROOT/docs/02-design/decisions/adr-template.md" "$TARGET/docs/02-design/decisions/"
cp "$ROOT/docs/03-plan/tasks-template.md" "$TARGET/docs/03-plan/"
cp "$ROOT/docs/04-progress/README.md" "$TARGET/docs/04-progress/"
cp "$ROOT/docs/05-testing/README.md" "$TARGET/docs/05-testing/"
cp "$ROOT/docs/06-experience/README.md" "$TARGET/docs/06-experience/"
cp "$ROOT/docs/07-ops/README.md" "$TARGET/docs/07-ops/"
generate_file_index "$TARGET" "$NAME" "$KIND"

# 3. 规范与脚本
cp -r "$ROOT/standards" "$TARGET/"
cp -r "$ROOT/scripts" "$TARGET/"
cp -r "$ROOT/prompts" "$TARGET/"
cp -r "$ROOT/scaffold" "$TARGET/"  # 支持在生成项目内再次 init（嵌套初始化）
mkdir -p "$TARGET/src" "$TARGET/tests"
touch "$TARGET/src/.gitkeep" "$TARGET/tests/.gitkeep"
chmod +x "$TARGET"/scripts/*.sh

# 4. kind 专属文件（dsh-plugin：package.json 双 tsconfig/构建门禁/SDD 骨架）
if [ "$KIND" = "dsh-plugin" ]; then
    KIND_DIR="$SCAFFOLD/kinds/dsh-plugin"
    [ -d "$KIND_DIR" ] || { echo "错误: 缺少 $KIND_DIR" >&2; exit 1; }
    # 4a. 全部 kind 文件：统一占位符替换后落地（.tpl 去后缀；KIND_NOTES.md 不落地）
    while IFS= read -r -d '' f; do
        rel="${f#"$KIND_DIR"/}"
        [ "$rel" = "KIND_NOTES.md" ] && continue
        out="$TARGET/${rel%.tpl}"
        content="$(<"$f")"
        content="${content//'{{PROJECT_NAME}}'/$NAME}"
        content="${content//'{{LANG}}'/${LANG:-node}}"
        content="${content//'{{DATE}}'/$(date +%Y-%m-%d)}"
        content="${content//'{{PROJECT_DESC}}'/（待补充：一句话说明本 DSH 插件做什么）}"
        mkdir -p "$(dirname "$out")"
        printf '%s\n' "$content" > "$out"
        echo "  实例化(kind): $rel"
    done < <(find "$KIND_DIR" -type f -print0 | sort -z)
    chmod +x "$TARGET"/scripts/*.sh 2>/dev/null || true
    chmod +x "$TARGET"/scripts/*.mjs 2>/dev/null || true
fi

# 5. git 初始化
if [ "$INIT_GIT" -eq 1 ]; then
    cd "$TARGET"
    git init -q
    git add -A
    git commit -qm "chore: init $NAME (dsh-engineering-starter, kind=$KIND)" \
        -m "type: chore" --allow-empty
    echo "  git 仓库已初始化并提交"
fi

echo ""
echo "✅ 项目初始化完成: $TARGET (kind=$KIND)"
echo ""
echo "下一步:"
echo "  1. 在 DSH 工程模式会话中打开该目录（workspace 指向 $TARGET）"
echo "  2. 发一句话需求，Agent 先 grill-me 澄清，再按七阶段执行"
echo "  3. 协议见 $TARGET/AGENTS.md（单一入口）"
echo ""
if [ "$KIND" = "dsh-plugin" ]; then
    echo "提示(dsh-plugin):"
    echo "  - npm install 后跑 npm run check（双端构建+产物门禁+冒烟）"
    echo "  - 工具链解析：本地 node_modules，或设 DSH_PLUGIN_TOOLS_DIR 指向含 esbuild/typescript 的目录"
    echo "  - 功能开发走 docs/specs/ 的 SDD 三件套；规格确认前不动手"
    echo "  - 验证用临时实例：DSH_HOME=\$HOME/.dsh-$NAME-test pnpm dsh web --port 3084"
fi