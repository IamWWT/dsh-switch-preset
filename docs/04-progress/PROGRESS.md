---
title: PROGRESS — dsh-switch-preset 进度真源
type: progress
status: active
version: 1.0.0
date: 2026-09-17
owner: AI + 用户
applies_to: dsh-switch-preset
---

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

## 🔄 进行中（中断点）

- **0.3.0 待用户重启 3082 生效**：插件已 link 安装 + lib 已重建 0.3.0，但运行中的 3082 是旧代码；
  用户选择稍后自行重启（`systemctl --user restart dsh-dev-web`）。重启后需验收：
  `/list-preset` 清单、空会话就地切换、**已开始会话强制切换（recompose）**、默认模式确认。

## ⏭ 下一步 + 待确认

1. **⚠️ 3082 安装被系统阻断（2026-09-17 用户选择暂缓）**：根挂载 `/` 处于只读降级态（fstab `errors=remount-ro`），`~/.dsh-dev` 物理不可写（`plugin add` 直接 EROFS；连带风险：运行中 3082 的持久化写入也可能失败）。用户选择**暂缓**，待 rootfs 恢复可写后再装：
   - 恢复后：`TARGET_DSH_HOME=$HOME/.dsh-dev bash scripts/install-to-dsh.sh`（或 `dsh plugin --profile web add <dir>`），**征得同意后** `systemctl --user restart dsh-dev-web`；
   - 重启后按 AC-1~11 交互验收。
2. 可选预览：临时实例 3084 仍运行（`http://127.0.0.1:3084/?token=...`，token 每次重启变化，见 bash job 输出）——可先在 3084 查看设置卡/🔄 选择器。
3. 验收通过后：`npm pack`（升版本号）出稳定版；清理 test-home/ 与 3084。
4. 工作区根 `progress.md` 登记本插件进度链接（跨插件协作约定）。