---
title: Tasks 001 — /switch-preset 任务拆解
type: tasks
status: draft
version: 1.0.0
date: 2026-09-16
owner: AI
applies_to: dsh-switch-preset
---

# Tasks 001 — /switch-preset 任务拆解

> 每任务三要素：改动文件 / done 定义 / 如何验证。粒度 = 一次逻辑改动（一个 commit，中文 message）。
> 依赖关系：T1 → T2 → T3 → T4（串行）；T2/T3 内部小步。

## M1 Host 指令

### T1 契约与切换逻辑（SwitchService）

- 改动文件：`src/shared/contracts.ts`、`src/host/switch.ts`、`test/switch-test.mjs`（新）
- done 定义：
  - contracts.ts 定义最小服务接口（Commands/SessionController/AgentPresets/PresetRow）与结果文本常量；
  - switch.ts 纯逻辑：`switchPreset(agent, presetId?, config)` → `{kind,text}`；含校验（preset 存在且非 broken）、分支（create/fork）、文本组装（sessionId 内嵌）、异常映射（fork-unavailable → 明确 error）；
  - switch.ts 不直接触碰 cordis ctx（服务以接口注入），可脱离运行时单测。
- 验证：`node test/switch-test.mjs`（mock 服务断言：成功/无效 preset/继承分支/无可 fork turn/文本含 sessionId）

### T2 命令注册与 Host 入口接线

- 改动文件：`src/host/command.ts`（新）、`src/index.ts`（改）
- done 定义：
  - index.ts：`Config = Schema.object({ inheritHistory: Schema.boolean().default(false) })`；`inject = ["commands","sessionController","agentPresets","settings"]`；`apply` 内注册设置命名空间 + 命令；
  - command.ts：`ctx.commands.register({ name:'switch-preset', description, input:{hint:'<preset-id>'}, handler })`，handler 组装 SwitchService 真实服务并执行；
  - 命令无参时输出当前模式（从 session 投影 `agentPreset`）+ roster 列表。
- 验证：`npm run check` 绿；产物门禁断言 host 导出与命令注册文本

## M2 设置

### T3 设置命名空间 + client 设置卡

- 改动文件：`src/client/settings-card.ts`（新）、`src/client/entry.ts`（改）、`cordis.patch.yml`（改，如需要）
- done 定义：
  - Host 侧 `settings.installSection` 注册 `switchPreset` 命名空间（T2 已含，此处验收）；
  - client 设置卡 `settings.plugin.item`（kind 唯一 `switchPreset`）读写 `inheritHistory`，主题 token，保存失败给明确文案；
  - entry.ts 注册卡片。
- 验证：`npm run check` 绿 + client 产物断言含设置卡槽；临时实例设置页可见

## M3 client 跳转

### T4 command/executed 监听 + openSession

- 改动文件：`src/client/session-jump.ts`（新）、`src/client/entry.ts`（改）
- done 定义：
  - `ctx.on('command/executed', ...)` 过滤 name==='switch-preset' 且 success → 提取 `session-<uuid>` → `uiWorkspace.openSession(id)`；
  - 提取失败/服务缺失 → 仅展示文本（降级）；`ctx.effect()` 注册保证回收；
  - `uiWorkspace` 以最小接口注入（client 侧服务名按实际注册名适配）。
- 验证：`npm run check` 绿；临时实例端到端：/switch-preset <id> → 自动跳转

## M3b client 模式选择器（用户补充需求 2026-09-16）

### T4b 弹出选择器（conversation.input.right 按钮 → roster 弹层 → 复用命令通道）

- 改动文件：`src/client/mode-picker.ts`（新）、`src/client/entry.ts`（改）
- done 定义：
  - 按钮注册到 `conversation.input.right`（order 错开；sessionId 经 inject 位置参数注入）；
  - 点击弹层展示 `agentPresets/list`（Remote）实时 roster（当前模式打勾、broken 禁用标注）；
  - 选中 → `remote.commands.execute(sessionId, '/switch-preset ' + id)`（无附件）；执行失败显示明确文案（带超时 AbortController，不无限转圈）；
  - 弹层样式走主题 token。
- 验证：`npm run check` 绿 + 临时实例 UI 点击流程（AC-11）

## M4 加固交付

### T5 文档与门禁

- 改动文件：README.md、CHANGELOG.md、docs/REQUIREMENTS.md、docs/TROUBLESHOOTING.md、docs/FILE_INDEX.md、docs/04-progress/（当日）
- done 定义：README 与代码行为一致；版本四处同步 0.1.0；doc-check/quality-gate 全绿（或记录跳过原因）；进度日志含失败/回退
- 验证：`npm run check` + `bash scripts/doc-check.sh`；临时实例回归 AC 清单

### T6 临时实例端到端验收（用户）

- 动作：`DSH_HOME=$HOME/.dsh-switch-preset-test pnpm dsh web --port 3084` 装插件 → 逐条 AC-1..AC-10 验证 → 呈现给用户
- done 定义：AC 全过或逐条记录未过项；用户确认后才上 3082
- 验证：真实命令输出入 docs/05-testing/

## 里程碑映射

| 里程碑 | 任务 | 验收 |
|--------|------|------|
| M0 脚手架 | （已完成） | check 绿 ✓ |
| M1 Host 指令 | T1、T2 | AC-1/2/4/5/6/7 |
| M2 设置 | T3 | AC-3/10 |
| M3 client 跳转 | T4 | AC-8 |
| M3b client 选择器 | T4b | AC-11 |
| M4 加固交付 | T5、T6 | AC-9 + 文档 + 用户确认 |