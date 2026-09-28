---
title: PROGRESS — dsh-switch-preset 进度真源
type: progress
status: active
version: 1.0.0
date: 2026-09-17
owner: AI + 用户
applies_to: dsh-switch-preset
---

## 当前状态

- 文档性质：进度真源（当前版本/进行中/下一步）
- **对应版本：v0.5.1（2026-09-28）**
- 状态：有效（如与实现不符，以代码与 `docs/REQUIREMENTS.md` 为准）
- 维护者：AI + 用户


# PROGRESS — dsh-switch-preset 进度真源

> 本文件是项目进度单一真源；工作区根 `progress.md` 只做链接索引。
> 结构约定：✅ 已完成（含证据）/ 🔄 进行中 / ⏭ 下一步 + 待确认。

## ✅ 已完成（最新一批，含证据）

- **P0-P2**：需求澄清闭环（用户确认 3 决策 + 选择器增强）→ `docs/00-request/request.md`、`docs/01-requirements/prd.md`、`docs/specs/001-switch-preset/`（spec AC-1~11 / plan / tasks）。
- **P3 脚手架**：`dsh-engineering-starter` 生成 dsh-plugin 骨架；依赖 npm 安装（本地缓存 `.npm-cache/`，避开 HOME 只读）；`npm run check` 空壳全绿。
- **T1-T4b 实现**（`npm run check` 全绿：build 门禁 + 双端 typecheck + 3 组测试）：
  - Host：`/switch-preset` 命令（`ctx.commands`）+ create/fork 切换逻辑（`src/host/switch.ts` 纯逻辑，8 组单测）；settings 命名空间 `switchPreset.inheritHistory`。
  - Client：设置卡（`settings.plugin.item`）+ 模式选择器（`conversation.input.right` 按钮 + roster 弹层 + `remote.commands.execute` 复用命令通道）+ `command/executed` 跳转（5 组单测）。
- **T5 文档**：README（行为一致）/ CHANGELOG / REQUIREMENTS / TROUBLESHOOTING（7 条含 DSH API 基线）/ FILE_INDEX / 本文件。
- **临时实例验证（3084，项目内 test-home）**：
  - `dsh plugin add` 成功、`dsh.profile.bundles` 含插件；
  - 修复 `cordis.patch.yml` 空数组缺陷后，`dump-config` 组合树**含插件条目**（`# == dsh-switch-preset`）；
  - 实例稳定运行；Web UI 正常渲染（DOM 检查：chat/composer/sidebar 齐全，无 client JS 崩溃）。
- **本会话踩坑已固化**：TS7 锁版、pnpm store 只读绕行（PNPM_HOME）、dsh-test-home 无 lockfile 依赖冲突（绕行新 home）、cordis.patch 空数组不实例化、视觉链 sharp 坏 → TROUBLESHOOTING §1-7。

## ✅ 已完成（最新一批，2026-09-18 追加）

- **v0.3.0「强制切换」**（用户要求：已开始会话也要换模式）：`/switch-preset <id>` 对已开始会话
  走 `ctx.agentPresets.recompose(agent.ctx, id)` 强制重装配 + `agent-preset/selected` 事件记录
  （投影/header 一致、重启后保持）；附工具解析警告；降级链 recompose→写默认→报错。
  `npm run check` 全绿（10 组逻辑单测）+ doc-check 通过；版本 0.3.0 四处同步；
  3082 为 link 安装（symlink→源码），lib/ 已重建。
- **304 8 08 期间已安装并验证**：0.2.1 修复「设置服务不可用」（settings 改用
  `ctx.inject(['settings'])` 二次注入 + 惰性解析）；用户实测 `/list-preset` 正常、
  已开始会话降级路径成功。client 产物门禁补「无顶层 import/export + node --check」。

## ✅ 已完成（最新一批，2026-09-21 追加）

- **以终为始清理**（用户要求）：移除 init 脚手架残留与无效内容——
  `tests/`（与 test/ 重复的空壳）、`src/.gitkeep`、`MANUAL.md`、`.env.example`、
  `prompts/`、`standards/languages/{java,python,rust,go}.md`、docs 各模板
  （example-request/prd-template/architecture-template/tasks-template/adr-template/specs/_template）、
  工程工具脚本（init-project/cleanup-framework/install-dsh/project-lib）、
  **无效 ADR-001**（fork/create 方案已废弃，由 **ADR-002**（recompose）取代并删除）、
  `lib-test/`（可再生产物）、`test-home/`（3084 已停，临时实例 99M）。
- **有效内容归档**：recompose 生产实证（session-f6101952：切换事件 seq545 + 完整 system prompt
  对比 learning/video）归档 `docs/05-testing/2026-09-21-recompose-production-proof.md` + 两份
  system-prompt 原文。
- 同步：FILE_INDEX 重写 v2.0.0、AGENTS.md 断引用修正（P2 tasks 路径、P3 .env.example）、
  decisions/README.md 索引登记 ADR-002。doc-check / npm check / quality-gate 全绿。
- 已推远程（私有 IamWWT/dsh-switch-preset）。

## ✅ 已完成（最新一批，2026-09-28 追加）

- **v0.5.1 路由参数可配 + 插件页原生配置区（闭合 spec 002 U1）**：
  - 参数：`routerEnabled`（默认 true；关闭 → `/router-preset` 只判定与展示，不切换、不投递，文案写明"自动切换已关闭"）
    + `routerThreshold`（默认 0.6、范围 0–1、非法回落，host 侧校验越界→400）；
    落在插件行 volatile 字段 `routerSettings`（读 `config.routerSettings.get()`，写 `settings.mutate(entryId, …)`）。
  - 落点：`src/shared/router-settings.ts`、`src/shared/threshold.ts`、`src/host/settings.ts`、
    `src/client/settings-card.ts`、`src/client/settings-api.ts`（均新增）+ `route.ts`/`command.ts`/`index.ts`/`entry.ts` 改造。
  - 证据：`pnpm check` 全绿（构建门禁 + 双 tsconfig + 5 组测试：冒烟 / switch / picker /
    router **22 项** / settings **25 项**，EXIT 0）；`bash scripts/doc-check.sh` 0 错 0 警。
  - 构建门禁增补：`plugins.bundle.config` 插槽 + **key = 包名**断言（key 写错会静默不渲染）。
  - **未做**：浏览器端到端实测（插件详情页看配置区 → 保存 → 行为改变），见下方"下一步"。
  - 交付物：`dsh-switch-preset-0.5.1.tgz`（旧 0.5.0 tgz 按"只留一份"删除）。

## ✅ 已完成（2026-09-26 追加）

- **docs 对齐审计（2026-09-26）**：README 版本改 0.4.1 + 补「环境支持矩阵」（ubuntu-4090 / windows-lite 均全量）+ 安装节改 tgz（无 link）+ 框架能力条目改 `remoteExportList()` / `settings.mutate('agent-preset-registry', selectedDefault)`；FILE_INDEX 补录 specs/20260925 三件套 + picker-test + paths.sh（doc-check §1 由 3 错转绿）；architecture.md 注入清单/默认模式真源/调用链图对齐 0.1.7；AGENTS.md 安装红线与规范路径表述修正；specs/README.md 去掉已删 `_template/` 引用。仅改文档，未动代码。

## 🔄 进行中（中断点）

- **v0.5.1 待浏览器验收**：代码与离线门禁已全绿，但**未在 3082/3084 实例里实际点开插件详情页验证配置区渲染与保存生效**
  （`pnpm check` 不能替代浏览器实测）。安装 0.5.1 tgz 并重启后按 SESSION.md「下一步」的判据验收。
- （历史）0.3.0 的 3082 重启验收：已随 0.4.x/0.5.x 安装完成，仅留档。

## ⏭ 下一步 + 待确认

1. **安装 0.5.1 + 浏览器验收（需用户授权重启 3082）**：
   `cd dsh-plugins/dsh-switch-preset && pnpm check && npm pack` →
   `DSH_HOME=$HOME/.dsh-dev pnpm dsh plugin --profile web add <abs>/dsh-switch-preset-0.5.1.tgz` →
   用户同意后 `systemctl --user restart dsh-dev-web` → 左侧栏「插件」→ dsh-switch-preset 详情页应出现
   「路由参数（/router-preset）」卡片；关掉自动切换后 `/router-preset <原话>` 只输出概率不切换。
2. 可选后续：把 `LocalModeScorer` 替换为 JEV 类模型（`ModeScorer` 接口已就绪，命令层零改动）。

### 历史待办（已闭合，留档）

- 2026-09-17「3082 安装被只读根挂载阻断」：后续 rootfs 恢复后已多次完成安装（0.2.1 → 0.5.1），仅留档。
- 临时实例 3084（`test-home/`）为测试专用、不入库；需要时 `DSH_HOME=<独立 home> pnpm dsh web --port 3084 --no-open` 重开。