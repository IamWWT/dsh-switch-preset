---
title: Plan 001 — /switch-preset 技术规划
type: plan
status: draft
version: 1.0.0
date: 2026-09-16
owner: AI
applies_to: dsh-switch-preset
---

# Plan 001 — /switch-preset 技术规划

## 1 技术架构

### 1.1 模块划分（Host / Client）

```
src/
├── index.ts                 # Host 入口：name/inject/apply/VERSION/Config(schema)
├── host/
│   ├── switch.ts            # SwitchService：校验 preset → create/fork → 结果（纯逻辑，可单测）
│   └── command.ts           # 注册 ctx.commands('switch-preset')，handler 调 SwitchService
├── client/
│   ├── entry.ts             # Client 入口：inject 声明 + 注册设置卡 + command/executed 监听
│   ├── settings-card.ts     # settings.plugin.item 卡（继承历史开关）
│   └── mode-picker.ts       # conversation.input.right 按钮 → 弹出 roster 列表 → 构造命令行 → remote.commands.execute
└── shared/
    └── contracts.ts         # 最小服务接口 + 命令结果文本常量（Host/Client 共享，单点适配 dsh API）
```

### 1.2 Host 侧

- `Config`（Schemastery）：`{ inheritHistory: Schema.boolean().default(false) }`，命名空间 `switchPreset`；
- `inject` 声明：`["commands", "sessionController", "agentPresets", "settings"]`；
  - `ctx.settings.installSection(ctx, 'switchPreset', Config, config)` 注册设置文档（settings 用 `ctx.inject(['settings'])` 二次注入亦可，实现时按 lint 收敛）；
- `SwitchService`：
  - `listModes()` → `ctx.agentPresets.list()`（映射为展示行：id/display/description/broken）；
  - `currentMode(agent)` → session 投影 `agentPreset`（`ctx.sessionController` 或 agents 解析；实现时以可注入的最小接口读取）；
  - `execute(agent, presetId?)`：
    - 无参 → 组装展示文本；
    - 带参 → 校验 preset 存在且非 broken → 按 `config.inheritHistory` 分支：
      - false：`ctx.sessionController.create({ agentPreset, workspaceId? })`（workspace 尽力解析，失败降级省略）；
      - true：先检查可 fork（有已完成 turn），再 `ctx.sessionController.fork({ sessionId })`；
    - 返回 `{ kind: 'success'|'error', text }`（文本含 `session-<uuid>` 供 client 解析）。
- 日志：切换路径 logger.info / 失败 logger.warn。

### 1.3 Client 侧

- `inject`（dsh.client.inject）：`["slots", "settingsScope", "remote.commands", "agentPresets"]`（按实际使用收敛）；
- 设置卡：`settings.plugin.item`（kind `switchPreset` 绑定命名空间 `switchPreset`），读 `settingsScope` 文档、写 `inheritHistory`；主题 token；
- 模式选择器（mode-picker.ts）：`conversation.input.right` 插槽（order 与既有插件错开）加按钮 → 点击弹层（roster 经 `agentPresets/list` Remote 实时获取：display/description/broken/当前模式打勾）→ 选中后 `remote.commands.execute(sessionId, '/switch-preset <id>')` 复用命令通道；
- 跳转：`ctx.on('command/executed', (sessionId, name, result) => ...)`：
  - `name === 'switch-preset' && result.kind === 'success'` → 从 `result.text` 提取 `session-<uuid>` → `uiWorkspace.openSession(id)`；
  - 提取失败/服务缺失 → 仅展示文本（降级，不崩溃）；
  - 监听注册用 `ctx.effect()` 保证卸载回收。

### 1.4 契约（shared/contracts.ts，最小自声明）

```ts
// 与 DSH 运行时形状一致的最小接口（不 import 服务包类型，规避 registry 预发布 semver 坑）
interface CommandsService { register(cmd: {...}): void; list(agent: unknown): Promise<unknown[]> }
interface SessionController { create(req): Promise<{sessionId:string; agentPreset?:string}>; fork(req): Promise<{sessionId:string}> }
interface AgentPresetsService { list(): Promise<PresetRow[]> }
interface UiWorkspaceLike { openSession(id: string): void }
```

## 2 选型与理由

| 决策 | 理由 |
|---|---|
| 复用 `ctx.commands` 而非自建解析 | 官方斜杠指令通道：语法/未知命令拒绝/执行记录/UI 支持全齐 |
| create/fork 而非自建复制 | DSH 官方会话操作：历史继承语义、workspace 关联、持久化天然正确 |
| 设置走 settings 文档而非 localStorage | 官方设置机制：与其它设置一致、卸载即清、Host/Client 单真源 |
| client 跳转走 `command/executed` 事件而非轮询 | 既有事件通道零成本；ui-workspace.openSession 官方导航 |
| 服务类型自声明最小接口 | registry 无稳定版服务包（0.1.x 全预发布），避免 semver 锁死与类型爆炸 |
| TS 锁 `<6.0.0` | 骨架脚本/产物门禁基于 TS5（TS7 exports 封锁 lib/tsc.js 实测失败） |

## 3 风险与对策

| 风险 | 对策 |
|---|---|
| `command/executed` 签名漂移 | 解析容错 + 降级文本（AC-8）；集中在 client entry 单点适配 |
| create 无 workspace 时新会话不可见 | 从当前 agent 解析 workspaceId 传入；解析失败降级（H4），文本提示可手动打开 |
| 继承模式 fork 前无 turn | 前置检查（session 最后事件含 turn/end），明确 error（AC-7） |
| 模式清单/健康度与 roster 漂移 | 一律 list() 实时取，不缓存不硬编码 |
| 设置卡样式走 token | 纯 `--dsw-*` 变量，禁色值（AC-10） |