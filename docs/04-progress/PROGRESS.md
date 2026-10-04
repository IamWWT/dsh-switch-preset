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
- **对应版本：v0.6.1（2026-10-05）**
- 状态：有效（如与实现不符，以代码与 `docs/REQUIREMENTS.md` 为准）
- 维护者：AI + 用户


# PROGRESS — dsh-switch-preset 进度真源

> 本文件是项目进度单一真源；工作区根 `progress.md` 只做链接索引。
> 结构约定：✅ 已完成（含证据）/ 🔄 进行中 / ⏭ 下一步 + 待确认。

## ✅ 已完成（最新一批，v0.6.0 2026-10-05）

- **`/router-preset-memory <原话>`（记忆路由，用户记忆路由指导文件第 2 步）**：
  - 与 `/router-preset` 相同判定→切换（复用 `switchPreset` 单一真源），但投递内容 =
    **dsh-kb 渐进加载的记忆（L1 人物画像 → L2 项目卡片关键词匹配 → L3 近 3 天会话日记）+ 原话**；
  - `src/host/memory.ts`（新增，纯逻辑零 LLM、零插件依赖）：kbRoot 四层回退
    （config → `DASH_KB_HOME` → 模块位置推导 → `~/dsh-kb`）；知识库缺失/读取失败 → `{ok:false}`
    明确说明，**不阻塞**切换与投递；
  - `routePreset` 可选第 6 参 `enrich`（不传行为与 v0.5.x 一致）；Config 新增 `kbRoot` volatile 字段。
- **B1 修复（2026-10-05 用户现场反馈：新会话下 `/router-preset` 未达阈值页面无输出）**：
  - 根因（上游代码实证闭环）：未达阈值只返回 CommandResult（无会话事件）→ host blank 状态机
    只认 `turn/start` 翻转（`session-controller/src/list.ts:49`）→ client chat 视图 isActive 要求
    非 command 节点（`chat-snapshot-builder.ts:1206` + 测试断言 command-only 会话 inactive）→
    activeTargets 实为 isActive 过滤（`assembly.ts:174`）→ `DefaultConversationViews.tsx:35`
    blank 返回 null → 页面空白。**影响所有纯文本命令（/list-preset 等），不只 router-preset**；
  - 修复（用户确认方案）：未达阈值**不切换模式**，但投递「判定详情 + 原话」到**当前模式**继续
    （投递产生 turn/start → blank 翻转 → 判定详情必然可见；原话不切错模式）；
    投递失败（通道缺失/被拒/抛错）如实回显"未投递 + 手动重发"，不假报成功；
  - 语义变更：v0.5.1「未达阈值不投递」→ v0.6.0「未达阈值不切换、但投递判定详情+原话到当前模式」；
    `routerEnabled=false` 分支保持不投递（尊重开关，只判定展示）。
- **验证**：双 tsconfig typecheck 全绿（@types/node 经 store junction 补链）；esbuild CLI 双端打包
  （lib/index.js 43695B 含 memory 接线 + VERSION 0.6.0）；6 组测试全绿（冒烟 / switch / picker /
  router **22 项**（2 处断言随 B1 语义更新）/ memory **6 项**（新增）/ settings **25 项**）；
  `npm pack` 产出 `dsh-switch-preset-0.6.0.tgz`（302945B，62 文件）。
- **环境修复（本会话）**：Windows 本机 pnpm install 中断残留（顶层 esbuild/@types/node 链接缺失、
  插件 lib/ 目录缺写权限）——esbuild/@types 建 junction 到 `.pnpm` store；lib/ ACL 按
  diagnose-windows-sandbox-acl 修复（报告在 `D:\myrepo\proj\deepseek\acl-recovery\`）。

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

- **v0.6.0 待浏览器验收（Windows 桌面版）**：代码、typecheck、6 组单测全绿 + `dsh-switch-preset-0.6.0.tgz`
  已打包，但**未安装**（Windows 装 tgz + 托盘退出后重开，需用户授权）。验收判据：
  ① 新会话 `/router-preset <低置信度原话>` → 判定详情页面可见 + 原话被当前模式继续（B1 修复现场场景）；
  ② `/router-preset-memory <原话>` → 判定详情 + 记忆加载回显 + 投递含 dsh-kb 记忆（需 profile kbRoot 配置指向 dsh-kb）；
  ③ 达阈值场景行为不变。
- （历史）0.3.0 的 3082 重启验收：已随 0.4.x/0.5.x 安装完成，仅留档。

## ⏭ 下一步 + 待确认

1. **安装 v0.6.0 + 浏览器验收（需用户授权）**：`npm pack` 已产出
   `dsh-switch-preset-0.6.0.tgz`；Windows 桌面版安装命令：
   `"D:/software/applications/DSH/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop add <abs tgz>` →
   用户同意后**托盘退出并重开桌面应用**（窗口 X 不退出进程）→ 按上方 🔄 的 ①②③ 判据验收。
   装完删旧 `dsh-switch-preset-0.5.1.tgz`（与 profile 引用变更同一步，只留 0.6.0 一份）。
2. 可选后续：把 `LocalModeScorer` 替换为 JEV 类模型（`ModeScorer` 接口已就绪，命令层零改动）。

### 历史待办（已闭合，留档）

- 2026-09-17「3082 安装被只读根挂载阻断」：后续 rootfs 恢复后已多次完成安装（0.2.1 → 0.5.1），仅留档。
- 临时实例 3084（`test-home/`）为测试专用、不入库；需要时 `DSH_HOME=<独立 home> pnpm dsh web --port 3084 --no-open` 重开。