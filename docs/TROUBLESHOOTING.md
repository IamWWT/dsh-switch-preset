---
title: TROUBLESHOOTING — dsh-switch-preset 排障记录
type: troubleshooting
status: active
version: 1.0.0
date: 2026-09-17
owner: AI + 用户
applies_to: dsh-switch-preset
---

# TROUBLESHOOTING — 现象 → 根因 → 修复 → 预防

> 本文件同时记录 DSH 框架 API 的**版本基线**（升级 deepseek-harness 后按此核对，
> 见 §5）。

## 1. npm 装到 TypeScript 7 导致构建/typecheck 失败

- **现象**：`npm run check` 时 build 产物生成但 typecheck 报 `找不到 typescript`。
- **根因**：`package.json` 写 `typescript: ">=5.0.0"`，npm 解析到最新 **TS 7.0.2**（原生
  Go 版）。其 `exports` 封锁了 `./lib/tsc.js`（`ERR_PACKAGE_PATH_NOT_EXPORTED`），而
  骨架的 `scripts/typecheck.mjs` 用 `require.resolve('typescript/lib/tsc.js')` 定位
  tsc——解析失败被 catch 吞掉 → 报"找不到 typescript"。
- **修复**：devDependencies 锁定 `"typescript": ">=5.0.0 <6.0.0"`（实测 5.9.3 通过）。
- **预防**：本插件不放开 TS 主版本约束；升级骨架脚本（改走 bin）前不装 TS6+。

## 2. pnpm store 只读（本机根挂载 ro）导致 `dsh plugin add` 失败

- **现象**：`dsh plugin --profile web add <插件>` 报 `EROFS: read-only file system,
  symlink ... -> ~/.local/share/pnpm/store/v11/projects/...`（exit 226）。
- **根因**：本机 `/` 根挂载为 **ro**（`/dev/nvme0n1p2 ext4 ro`），pnpm 默认 store
  `~/.local/share/pnpm/store` 落在只读区，任何进程都无法写入（非沙箱策略，是真实
  只读挂载）。`npm_config_store_dir` / `XDG_DATA_HOME` / profile `.npmrc store-dir`
  均不生效；**`PNPM_HOME` 覆盖 store 位置有效**（`PNPM_HOME=<可写目录> pnpm store path`
  确认）。
- **修复**：安装命令前加 `PNPM_HOME=<工作区内可写目录>`；若 profile 的 node_modules 已
  从旧 store 链接，需先 `CI=true pnpm install` 全量重装到新 store
  （`ERR_PNPM_UNEXPECTED_STORE` / `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`）。
- **预防**：`scripts/install-to-dsh.sh` 依赖调用方传入 `PNPM_HOME`；新环境先探测
  `pnpm store path` 是否可写。

## 3. 测试 home（dsh-test-home）profile 无 lockfile，全量解析撞既有插件版本声明

- **现象**：对 `dsh-test-home/profiles/web` 跑 `pnpm install`（重建依赖）失败：
  `@deepseek-ai/dsh-tools@>=0.1.0` 无匹配版本（registry 最新稳定 0.0.1-rc.1）。
- **根因**：该 profile 无 `pnpm-lock.yaml`（或已失效），pnpm 全量重新解析；某已装插件
  peer 声明 `@deepseek-ai/dsh-tools: ">=0.1.0"`（PLUGIN-DEV-STANDARD 模板字段），与
  registry 现状（只有预发布）冲突。**与本插件无关**（本插件 peer 仅 `@deepseek-ai/cordis`）。
- **修复/绕行**：改用**全新测试 home**（`dsh-switch-preset/test-home/`）验证本插件，
  不修复该 profile（不属于本项目职责，涉及既有插件依赖，需维护者介入）。
- **预防**：本插件 peerDependencies 保持最小（仅 cordis）；不引入 dsh-tools/settings
  等 registry 无稳定版的 peer。

## 4. client 侧 `makeUi` 全局 runtime 被二次调用覆盖（设计缺陷）

- **现象**：设置卡与模式选择器分两次 `makeUi(...)` 装配，第二次调用覆盖全局
  RUNTIME → 先注册的组件运行时读到后装配的依赖（空实现）。
- **根因**：ui.ts 用模块级 `RUNTIME` 缓存依赖，多入口注册点先后调用互相覆盖。
- **修复**：entry.ts 改为**单次装配**（settings 与 picker 依赖同时构建后一次
  `makeUi`），缺失项用 no-op 依赖占位；组件在依赖缺失时不注册。
- **预防**：client 依赖注入集中 entry.ts；ui 模块不缓存可变状态。

## 5. DSH API 版本基线（升级 deepseek-harness 后核对）

| API | 本插件用法 | 基线（2026-09-16 源码） |
|-----|-----------|------------------------|
| `ctx.commands.register(def)` | handler 收 `{agent, rawInput}`，返回 `{kind:'success'|'error', text}` | `packages/interaction/commands`（handler 返回 CommandResult；未声明 `input.attachments` 时 attachments 恒空） |
| `ctx.sessionController.create({agentPreset, workspaceId?})` | 不继承历史 + 目标 preset | `packages/api/session-controller`（`@Remote('create')`；`workspaceId`/`cwd` 二选一） |
| `ctx.sessionController.fork({sessionId})` | 继承历史（preset 保持源会话） | 同上（`@Remote('fork')`；无已完成 turn 抛 `session/fork-unavailable`） |
| `ctx.agentPresets.list()` | roster（id/displayName/description/broken） | `packages/preset/agent-presets`（`@Remote('list')`） |
| `ctx.workspaceRegistry.list()` | 找含当前会话的 workspace（可缺失） | `packages/workspace/workspace`（core seam；sessionIds 字段） |
| `ctx.sessionProjections.stateOf(session, 'agentPreset')` | 当前模式（可缺失） | `packages/session/session-projection`（key `agentPreset`） |
| client `command/executed` 事件 | 过滤 `switch-preset` + success → 跳转 | `packages/client/ui-commands` service（emit `(sessionId, name, result)`） |
| client `sessions.open(id)` | 跳转（必须保引用调用 `open.call(svc, id)`） | `packages/client/connection` ISessions（方法体依赖 `this.manager`） |
| client `settingsScope.bind({namespace})` | `get()/update()/watch()` | `packages/settings/settings`（`@deepseek-ai/dsh-settings`） |
| `remote.commands.execute(sessionId, line, attachments)` | 选择器复用命令通道 | `packages/client/ui-commands`（RpcResult 包裹） |
| `remote.agentPresets.list()` | 选择器 roster 弹层 | `packages/client/ui-agent-preset`（RpcResult 包裹） |

升级后核对项：命令 handler 签名、create/fork 参数、roster 字段名、command/executed 载荷、
sessions.open 服务名、settingsScope API。
## 6. cordis.patch.yml 顶层空数组 → 插件进 bundles 但**不实例化**

- **现象**：插件安装后 `dsh.profile.bundles` 含 `dsh-switch-preset`，但 `pnpm dsh --profile web --dump-config` 组合树无该插件条目；host `apply` 不执行（无日志、命令不注册）。
- **根因**：bundle 的 patch 文件若为合法但**空的顶层数组**（`[]`），loader 不注入任何实例化行——插件只是"在清单里"，从未被 compose。DSH 的插件实例化靠 patch 的 `- insert:` 块声明 `id/name`（可带 `config`），参考 `dsh-scheduled-send/cordis.patch.yml`。
- **修复**：patch 改为
  ```yaml
  - insert:
    - id: switch-preset
      name: dsh-switch-preset
  ```
  （config 省略时用插件 schema 默认；用户 cordis.yml/设置文档可覆盖。）
- **预防**：产物门禁/冒烟无法覆盖（需运行态 dump-config）；安装验证清单增加 `pnpm dsh --profile <p> --dump-config | grep <插件名>` 必须命中。

## 7. 视觉工具链依赖 sharp（detect-libc 缺失）不可用

- **现象**：`read_image` / `vision_describe` / `vision_ocr` 报 `Cannot find module 'detect-libc'`（harness `attachment-local` 的 sharp）。
- **根因**：harness node_modules 中 sharp 的依赖缺失（本机环境问题，与插件无关）。
- **绕行**：UI 验证改用 Chrome headless `--dump-dom`（DOM 文本）与 `--screenshot`（产物留档）；交互验证走真实浏览器/用户验收。
- **预防**：与插件无关，记录备查。

## 8. v1.1 关键 API 补充基线（2026-09-17）

| API | 本插件用法 | 基线 |
|-----|-----------|------|
| `ctx.agentPresets.select(agent, presetId)` | 空会话**就地换模式**（留在当前会话） | `packages/preset/agent-presets` `@Remote('select')`：按 `turnBoundary` 判定，`openTurnStartSeq !== null \|\| lastTurn > 0` 即抛 `RemoteError('agent-preset/locked')` |
| `ctx.settings.update('agent-presets', { default })` | 已开始会话降级：写**默认模式** | `packages/settings/settings` `SettingsProvider.update(ns, patch)`（写 user 层）；命名空间常量 `SETTINGS_NAMESPACE = 'agent-presets'`，键 `default` / `modeSelectionEnabled` |
| roster 中文名/描述 | `/list-preset` 展示 | `<DSH_HOME>/.agent-presets/<id>/preset.yml` 的 `name` / `description`（本机为中文），经 `agentPresets/list` 的 `displayName`/`description`/`isDefault` 透出 |

**排查提示**：`/switch-preset` 提示"已开始会话 preset 固定"属预期降级（非 bug）；若 `settings` 服务缺失，
写默认模式会明确报错——此时检查 web profile 是否组合了 `@deepseek-ai/dsh-settings`。

## 9. 已开始会话换模式：recompose 强制重装配（0.3.0）

- **需求**：用户要求"已开始的会话也能换模式"（DSH `select` 对已开始会话抛 `agent-preset/locked`）。
- **实现**：`ctx.agentPresets.recompose(agent.ctx, id)` 无空会话锁定检查（锁只存在于
  `select`→`swap`），可对任意会话重装配；随后用 `agent.session.append('agent-preset/selected',
  { agentPreset })` 记录（与 `swap` 内部一致），使 `agentPreset` 投影/session header 更新，
  重启后按新模式重建会话。
- **风险**：换 preset = 换工具集/prompt；历史中旧模式独有工具的调用记录在新模式下
  无法解析（这是框架默认禁止的核心理由）。已在切换成功文本中附警告。
- **降级链**：`recompose` 缺失 → 写默认模式（`agent-presets.default`）；再失败 → 明确报错。
- 基线：`packages/preset/agent-presets/src/index.ts` `recompose(agentCtx: Context, id)`。
