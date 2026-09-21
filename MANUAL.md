---
title: 使用手册
type: guide
status: active
version: 2.0.0
date: 2026-09-13
owner: AI + 维护人
applies_to: 使用者（人）
references:
  - README.md
  - AGENTS.md
  - prompts/README.md
---

# 使用手册 — dsh-engineering-starter

> 给人看的操作手册：怎么装、怎么用、怎么维护。
> Agent 执行的协议在 [AGENTS.md](AGENTS.md)；指令模板在 [prompts/](prompts/README.md)。

---

## 1. 角色分工

| 谁 | 负责 |
|----|------|
| **你（人）** | 发一句话、关键关口确认（PRD/架构/规格/验收）、纠正方向 |
| **Agent（工程模式）** | 需求澄清（grill-me）→ 设计 → 计划 → 实现 → 测试 → 文档 → 经验，全流程执行并诚实落档 |

你实际要做的只有三件事：说清目标；在关键关口看一眼产物（"继续/改方向"）；验收。

---

## 2. 安装

```bash
cd frameworks/dsh-engineering-starter
scripts/install-dsh.sh
```

- 把 preset（含随包 skills/）装到 `$DSH_HOME/.agent-presets/engineering/`（`$DSH_HOME` 缺省 `~/.dsh-dev`）；
  随包 skills 以 preset 层注册（scoped shadow），**不写 `~/.agents/skills`**，你的全局技能根原样保留。
- 幂等；已存在的先备份为 `*.bak-<时间戳>`。`--uninstall` 卸载（同样保留备份）。
- 覆盖选项：`--dsh-home <dir>`。
- **无需重启 DSH**：preset 在每次 roster 读取时重新发现，新开会话即生效；运行中的会话不受影响。

## 3. 第一次使用

1. DSH 里**新建会话**，选「工程模式」。
2. workspace 指向：本仓库（框架自身开发 / `projects/` 子项目）或任意已有项目目录。
3. 发一句话，三要素：**目标 + 技术偏好 + 关键约束**（缺的 Agent 会假设并记录，不会反复问）：

```
帮我创建一个短链接服务：内部用，Go + Redis，读 QPS 峰值 5000，要支持管理后台
```

Agent 随后：grill-me 拷问 → `docs/00-request/request.md`（原话+假设表）→ PRD → 架构+ADR →
任务计划 → 脚手架 → 分批实现（每批：代码+测试+进度）→ 测试加固 → 交付复盘。
每阶段产物都在 `docs/`，你可以随时抽查。

模板与自然语言控制词（"不用问直接做"/"每步先确认"/"只做 P0"）见
[prompts/README.md](prompts/README.md)。

## 4. 生成新项目

```bash
# 普通应用
scripts/init-project.sh ../my-service --lang go --name "短链接服务" --git

# DSH 插件（自动带 dsh 字段/双 tsconfig/构建门禁/SDD 骨架）
scripts/init-project.sh ../dsh-minesweeper --kind dsh-plugin --git
```

生成的项目**自包含**：AGENTS.md（协议）+ standards/ + scripts/（门禁）+ docs/ 骨架全部拷入，
之后在任何 Agent 里打开该目录都能按同一套纪律工作。

## 5. DSH 插件开发要点（kind = dsh-plugin）

完整规范：本机 deepseek-harness 仓库 `dsh-plugins/PLUGIN-DEV-STANDARD.md` +
`DEV-WORKFLOW-GUIDE.md`（L0–L4 复杂度分级）；骨架已内置纪律摘要（生成项目的 AGENTS.md §2A）。

1. **SDD 强制**：`docs/specs/<id>/` 三件套 `spec.md → plan.md → tasks.md`；
   spec 未获你确认前，Agent 禁止实现。
2. **构建门禁**：`npm run check` = 双端 esbuild（Host→`lib/index.js`，Client→`lib/client.js`）
   + 产物断言 + 双 tsconfig typecheck + 冒烟。工具链：`npm install` 或
   `DSH_PLUGIN_TOOLS_DIR=<含 esbuild/typescript 的 node_modules>`。
3. **版本四处同步**：package.json = `src/index.ts` VERSION = tgz 文件名 = README/CHANGELOG。
4. **验证红线**：
   - 未验证改动**禁止**上生产（3082）；临时实例验证：
     `DSH_HOME=$HOME/.dsh-<插件名>-test pnpm dsh web --port 3084`
   - 开发期 link 安装；tgz 仅稳定版（必须升版本号）；
   - 生产实例的任何重启/重载，先经你同意。

## 6. 会话续接与交接

- 新会话启动：Agent 先读 `SESSION.md`/`MEMORY.md`，向你汇报"上次进度/下一步/待确认"，
  你确认后才动手（铁律 15）。
- 结束前：`scripts/handoff.sh` 更新交接单；长任务用 DSH goal 跟踪；批量独立任务用 subagent。

## 7. 日常命令（项目内）

```bash
scripts/doc-check.sh       # 文档一致性（FILE_INDEX/断链/占位符/frontmatter/AGENTS.md 体量）
scripts/quality-gate.sh    # 质量门禁（每里程碑）
scripts/journal.sh "..."   # 追加进度日志
scripts/experience.sh "主题" "场景" "问题" "根因" "解决"  # 经验条目
```

## 8. 维护本框架

| 想改什么 | 改哪里 | 生效方式 |
|---|---|---|
| preset persona / 工具集 | `presets/engineering/agent.cordis.yml` | 重跑 `scripts/install-dsh.sh`，新会话生效 |
| skill 内容 | `presets/engineering/skills/<name>/` | 重跑 `scripts/install-dsh.sh`（随 preset 走，preset 层 shadow，不动 `~/.agents/skills`） |
| 工程协议/铁律 | 本仓库 `AGENTS.md`（铁律只增不删） | 新 init 的项目自动带上；旧项目由该项目 Agent 同步 |
| 规范（standards/） | `standards/` | 同上（生成项目持有副本） |

本仓库自身也是工程模式的 dogfood 项目：改框架也走七阶段 + doc-check/quality-gate。

## 9. 常见问题

| 问题 | 答案 |
|---|---|
| 为什么 persona 只有 ~20 行？ | 铁律 4/16：规则单一真源在项目 AGENTS.md；persona 只做入口+兜底，system prompt 保持薄。 |
| 为什么没有 CLAUDE.md？ | v2.0 是 DSH 专属版，协议入口统一为 AGENTS.md（DSH 原生读取）。 |
| preset 装哪？ | `$DSH_HOME/.agent-presets/engineering/`（默认 `~/.dsh-dev`）。 |
| skill 装哪？ | 随 preset 走：`presets/engineering/skills/` → 以 preset 层注册，工程模式内 shadow 全局同名技能；`~/.agents/skills`（全局根）原样保留。 |
| 要重启 DSH 吗？ | 不需要；只影响新开的会话。 |
| 项目 AGENTS.md 与 preset 冲突听谁的？ | 项目 AGENTS.md 优先。 |
| 企业规范怎么进？ | 原始文档放 `standards/enterprise/_inbox/`，说"导入企业规范"（见 prompts/import-standards.md）。 |
| 不想被 grill？ | 指令里加"不用问直接做"；Agent 走假设表并留痕。 |

## 10. 目录结构

```
AGENTS.md            # Agent 总协议（入口，薄）
MANUAL.md            # 本手册（人）
MEMORY.md            # 框架自身状态/待办/硬约束
presets/engineering/ # 工程模式 preset（preset.yml + agent.cordis.yml）
presets/engineering/skills/  # grill-me / grilling / project-discipline（随 preset 走）
AGENTS.md + standards/ + prompts/ + scaffold/ + scripts/   # 生成项目的协议/规范/模板/工具
scaffold/kinds/      # 项目模板：dsh-plugin（generic 为默认）
docs/                # 本框架自身文档（00-request … 07-ops + FILE_INDEX）
projects/            # 在本仓库内开发的项目（每项目一目录）
```