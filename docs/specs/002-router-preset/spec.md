---
title: Spec 002 — /router-preset 一句话路由切模式
type: spec
status: delivered
version: 2.1.0
date: 2026-09-28
owner: AI + 用户
applies_to: dsh-switch-preset
---

## 当前状态

- 文档性质：规格 002（/router-preset 概率路由，已交付）
- 对应版本：v0.5.0 交付 → **v0.5.1 结项 U1（2026-09-28）**
- 状态：有效（如与实现不符，以代码与 `docs/REQUIREMENTS.md` 为准）
- 维护者：AI + 用户


# Spec 002 — `/router-preset` 一句话路由

## 头部元信息

- **状态：已交付（v0.5.0，2026-09-28；U1 于 v0.5.1 结项）**；本文件已按**实际实现**校准
  （v1.0.0 草稿描述的是更早一版设想，见 §2 演进）。
- 交付物：`dsh-switch-preset-0.5.1.tgz`（v0.5.0 首交付 `dsh-switch-preset-0.5.0.tgz`）；
  `pnpm check` 全绿（v0.5.1：5 组测试 = 冒烟 / switch / picker / `router-test` **22 项** /
  `settings-test` **25 项**）。
- 端到端：3084 隔离实例实测（v0.5.0 判定→切换→投递链路）；**v0.5.1 配置卡片的浏览器端到端未实测**（见 §6 U4）。
- 维护者：AI + 用户。

## 1 需求（两轮，用户原话）

**第一轮（更早）**：
> "switch-preset 这个插件更新一下, 新增一个 / 模式, 要求 / router-preset 后面跟用户的一句话后,
> 能立马识别用户这句话应该适用于切换到什么模式执行任务, 并在插件设置页面可设置开启或关闭是否识别后执行切换"

**第二轮（2026-09-28，本轮落地依据）**：
> "如果不给答案可以给出判定某个模式命中的概率, 概率第一高的就是要切换的 类似 jev 模型"
> "就是落到 /router-preset xxx 这个指令里面. 等于是这条指令触发 preset 概率判定 + switch preset 操作 +
> 用户原本内容在切换后的 preset 模式下的后续输入 agent 交互"

**本轮澄清裁决**（用户确认）：① 概率引擎先落**本地确定性打分**（零依赖/可测/离线可用），
接口可插拔以便后续接入 JEV 类模型；② Top-1 ≥ **0.6** 才自动切换，低于阈值只提示；
③ 原话接力机制：先按"客户端接力"设想 → **实测推翻**，改为 Host 侧投递（§3.3）。

## 2 设计演进（v1.0.0 草稿 → v2.0.0 实交付）

| 维度 | 草稿设想（v1.0.0） | 实交付（v2.0.0） | 变更依据 |
|---|---|---|---|
| 识别引擎 | 只用模型判定（`ctx.llm.prepareCall()`，关思考 + temperature 0） | **本地确定性打分**（`ModeScorer` 接口 + `LocalModeScorer`），预留 JEV 模型接入点 | 用户第二轮裁决①；本地引擎可单测、离线可用、零延迟 |
| 切换策略 | 识别后**直接切换**（设置开关控制） | **阈值门控**：Top-1 ≥0.6 才切；<0.6 只展示概率分布 | 用户本轮裁决② |
| 输出形态 | 单个模式名 + 一句依据 | **完整概率分布**（含命中词，可解释）+ 冠军 + 是否达阈值 | 用户"概率第一高的就是要切换的，类似 JEV 输出" |
| 设置项 | `routerEnabled` + `routerProvider` / `routerModel` + 设置卡 | **已实现（v0.5.1）**：`routerEnabled` + `routerThreshold`，落在插件页原生配置区 `plugins.bundle.config` | 用户 2026-09-28 本轮要求（结项 U1）；`routerProvider`/`routerModel` 仍留待接入模型引擎（U2） |
| 原话后续输入 | 未涉及 | **Host 侧投递**（`sessionController.prompt`），在新模式下 `turn/start` 处理 | 用户第二轮要求"原话在切换后的模式下继续" |

> 草稿 §3.2 关于 `ctx.llm` 的合规论证**仍然有效**并保留价值：将来把 `LocalModeScorer` 换成
> 模型/ JEV 引擎时，`ctx.llm`（宿主公开模型服务：adapter 路由 + retry + 计量）是合规通道，
> 而 `sessionController.prompt` **没有输出通道**（只返回 `{accepted:true}`），不能用于"同步拿分类结果"。
> 该结论已在草稿中逐条论证，本版不再重复（见 git 历史 / CHANGELOG 0.5.0）。

## 3 实交付设计

### 3.1 概率引擎（`src/host/router.ts`，可插拔）

- `ModeScorer` 是**唯一**打分接口：`score(candidates, utterance, threshold) → ScoreBoard`。
  换引擎（JEV 类模型 / `ctx.llm`）只实现该接口，**命令层与客户端零改动**。
- 当前实现 `LocalModeScorer`（engine id `local-keyword-v1`）：
  **强特征表**（人工提炼高区分度动作/交付物词，权重 3）+ **弱特征**（各模式 name/description
  自动切词，权重 1）+ 均匀先验 → 归一化为概率，**sum=1、按概率降序**，并记录**命中词**（可解释）。
- **无判别力处理**：全部候选概率并列时置 `undetermined`，输出"**无法判定**"，
  **不切换、不推荐**任意模式（排序副产物不算结论）。此分支由现场实测发现（内置模式 roster 下概率全为 1/n），已修。
- 候选集一律取自运行时 roster（`agentPresets.remoteExportList()`），**源码无硬编码模式清单**。

### 3.2 决策与切换（`src/host/route.ts`）

参数（v0.5.1 起可配，来自插件页配置区的 volatile 字段 `routerSettings`）：

| 参数 | 默认 | 范围 | 语义 |
|---|---|---|---|
| `routerEnabled` | `true` | 布尔 | 关闭 → 只判定与展示，**不切换、不投递**（输出明确写"自动切换已关闭"） |
| `routerThreshold` | `0.6`（`DEFAULT_ROUTE_THRESHOLD`） | `0`–`1` | 达阈值才自动切换；非法值（越界/非数/NaN）回落 0.6，不抛错 |

| 情形 | 行为 |
|---|---|
| `routerEnabled=false`（v0.5.1） | **判定后、切换前**返回：照常输出完整概率分布与最高概率模式，但**不调用 `switchPreset`、不投递**；文案含"自动切换已关闭" + 恢复办法 + 手动切换指引 |
| Top-1 ≥ 阈值（默认 0.6） | **复用 `switchPreset()`** 切换（select → recompose → 写默认四级降级，单一真源），随后投递原话 |
| Top-1 < 阈值 | 只展示概率分布 + 提示 `如确认切到 X：/switch-preset <id>`；**不切换、不投递** |
| 全部并列（`undetermined`） | 输出"无法判定"，**不切换、不推荐** |
| 切换失败 | 返回 error，**绝不投递**原话（避免在原模式下误跑） |
| 无参调用 | error + 用法说明，零副作用 |
| 阈值/开关非法（v0.5.1） | `normalizeRouterSettings()` 字段级回落默认值，命令正常执行、绝不崩 |

参数读写（v0.5.1，0.1.7 原生设置面，见 `src/host/settings.ts`）：

- **读**：插件行 volatile 字段 `config.routerSettings.get()`（loader 维护的当前值）；
- **写**：`settings.mutate(entryId, [{op:'set', path:['routerSettings', <key>], value}], revision)`，
  `entryId` = profile 条目 id（`c.fiber.entry.options.id`，非包名）；
- **热更新**：`ctx.on('loader/volatile-update', paths)`（`paths[0] === 'routerSettings'`）；
- **数据面**：插件自有 REST（`GET|PUT /api/dsh-switch-preset/settings`、`GET /settings/watch`），
  供插件页配置区卡片读写（0.1.7 已移除客户端 `settingsScope` 服务）。

### 3.3 原话投递（`SwitchDeps.deliverUtterance`，Host 侧）

- 切换成功后经 core 服务 `sessionController.prompt({ mode:'queue', content:[{type:'text',text:原话}] })`
  把原话投进该会话的**用户输入队列**；会话日志里是一条 `role:"user"` 的普通用户消息，
  随后 `turn/start` 在**新模式**下处理它。**插件不调用任何模型 API**。
- **为何不用"客户端接力"**（草稿后的最初设想，已实测推翻）：上游命令 handler 明确
  "不把命令发给模型"（`packages/interaction/commands/src/index.ts`），`CommandResult` 只有
  `{kind,text,sourceEventSeq}`；客户端**没有公开钩子**能观察"用户键入的命令"结果
  （`conversation.composer.bar` 的 `hooks.notices` 为 package-private 且插槽 single 已被占用）。
  客户端接力只能覆盖插件自己发起的调用，覆盖不了 `/router-preset xxx` 主路径 → 投递必须落在 Host 侧。
- **失败三态如实回显**：通道缺失 / 被拒（`accepted≠true`）/ 抛错，均输出"**未投递**"+ 指引手动重发，
  不假报成功（铁律 #8 显式失败）。

### 3.4 客户端（`src/client/ui.ts` + `settings-card.ts`，v0.5.1）

- composer 模式菜单（`conversation.input.right` 的 ⇄ 按钮）**置顶新增**「⚡ 按内容自动判定模式」：
  取当前草稿（会话 standard props 的 `useInput` hook）作为原话执行路由；
- 展示 Host 返回的判定与投递实况；未达阈值时在同一位置展示概率明细（说明"为什么没切"）。
- 只展示、不接力（投递在 Host 侧）；CSS 全部主题 token。
- **插件页配置区（v0.5.1）**：注册 `plugins.bundle.config`（**keyed 槽，key = 包名 `dsh-switch-preset`**，
  上游只在该包名注册过时才渲染该区：`configured = ledger.bundles.has(pkg.name)`；`view === 'page'` 才渲染正文），
  卡片含「自动切换」开关 + 「判定阈值」数字框 + 保存 / 恢复默认 + 失败明确文案；
  数据面走 `settings-api.ts`（REST + 长轮询热同步），CSS 全 `--dsw-*` token、异步全带超时。

## 4 验收（已达成）

| # | 验收标准 | 结果 |
|---|---|---|
| AC-1 | 概率分布覆盖全部可用模式、sum=1、按概率降序、含命中词 | ✅ 单测 |
| AC-2 | 四类典型输入判出正确模式且达阈值（工程/视频/排障/学习） | ✅ 单测 |
| AC-3 | Top-1 ≥阈值 → 切换成功 + 投递原话 | ✅ 单测 + 3084 实测 |
| AC-4 | <阈值 → 零副作用（不切换、不投递、不写默认） | ✅ 单测 |
| AC-5 | 切换失败 → 不投递 | ✅ 单测 |
| AC-6 | 投递三态（缺失/被拒/抛错）均如实回显"未投递" | ✅ 单测 |
| AC-7 | 全部并列 → "无法判定"、不推荐、不切换 | ✅ 单测 + 3084 实测（内置模式 roster） |
| AC-8 | 损坏模式不参与判定 | ✅ 单测 |
| AC-9 | 无参 → 用法 error、零副作用 | ✅ 单测 |
| AC-10 | 候选集来自 roster（换 roster 候选集跟着变） | ✅ 单测 |
| AC-11 | 切换语义复用 `switchPreset`（不新写降级逻辑） | ✅ 代码审查 + 单测（断言 select/recompose 调用） |
| AC-12 | 构建门禁全绿（双端打包 + 产物断言 + 双 tsconfig + 5 组测试） | ✅ `pnpm check`（v0.5.1） |
| AC-13 | 端到端：键入命令 → 判定 → 切换 → 原话在新模式下被处理 | ✅ 3084 实测（见 §5，v0.5.0 链路） |
| AC-14 | **v0.5.1**：`routerEnabled=false` → 仍给完整概率判定，但零副作用（不 select/recompose/写默认/投递），文案说明"自动切换已关闭" | ✅ 单测（`router-test` 新增 3 项） |
| AC-15 | **v0.5.1**：`routerThreshold` 可配且生效（0.99 不再切换、0 照旧切换；回显阈值 = 配置值） | ✅ 单测 |
| AC-16 | **v0.5.1**：非法阈值（越界/负/NaN/Infinity/字符串/null）回落 0.6，不崩；host 侧写入校验越界 → 400 且不写 | ✅ 单测（`router-test` + `settings-test`） |
| AC-17 | **v0.5.1**：插件详情页配置区接线正确（`plugins.bundle.config` + key = 包名 + REST 数据面 + `Config` volatile 字段） | ✅ 产物/冒烟断言 + 配置卡片组件 6 项单测（**浏览器实测未做**，见 U4） |

## 5 实测证据（3084 隔离实例，2026-09-28）

真实 6 模式环境（agent-presets 已装）键入
`/router-preset 帮我把这个项目做成一个演示视频，需要配音和字幕`，会话日志时序：

```
command/run   {name:"router-preset", args:" 帮我把这个项目做成一个演示视频，需要配音和字幕"}
agent-preset/selected {agentPreset:"video"}                     ← ② 切换生效
agent/inbox/spliced  {inserted:[{text:"帮我把这个项目做成一个演示视频，需要配音和字幕", role:"user"}]}  ← ③ 投递
turn/start {turn:1}                                             ← ④ 在新模式下处理
system/message = "你是 DSH 视频模式（video）Agent…"               ← 新模式人设生效
user/message   = 原话原文
command/done  {kind:"success", text:"视频模式（video） 80.3%  命中：视频、配音、字幕、演示视频、项目、演示 → …已切换…已作为该会话的后续输入投递"}
```

唯一 `turn/end` 错误为 `MISSING_CREDENTIAL`（测试 home 未配 API key，属环境，与功能无关）。
另：内置模式 roster（standard/cordis/minimal/ptc）下正确输出"**无法判定**"、不切换、不推荐。

### 5.1 v0.5.1 证据（本机，2026-09-28）

本轮为**离线门禁证据**（真实命令输出，非浏览器实测）：

```
pnpm check
  [build] dsh-switch-preset：lib/index.js + lib/client.js 生成并通过产物门禁   ← 含 plugins.bundle.config + key=包名 断言
  [typecheck] tsconfig.json / tsconfig.client.json                          ← 双端 strict 全绿
  ✅ 冒烟测试全部通过（+ Config 导出 / volatile 字段 / 静态 inject 为空 / 配置区接线 6 条断言）
  ✅ switch-test 全部通过
  PASS native preset picker placement, roster, disabled rows, selection and dismissal
  [router] 22 项通过    ← 15 项既有 + 7 项可配参数新用例
  [settings] 25 项通过  ← 归一化/校验/门面/REST/Config schema/配置卡片
EXIT: 0
```

## 6 未决项

| # | 事项 | 影响 | 状态 |
|---|---|---|---|
| U1 | 更早一轮要求的「设置页开关自动切换（`routerEnabled`）+ 设置卡」 | — | ✅ **已实现（v0.5.1）**：`routerEnabled` + `routerThreshold` 落在插件页原生配置区 `plugins.bundle.config`（key = 包名），host 侧阈值校验、非法值回落不崩 |
| U2 | `routerProvider` / `routerModel`（指定更快的分类模型）**未实现** | 本地引擎无此需求；接入 JEV/模型引擎时才需要 | 待接入模型引擎时一并做 |
| U3 | JEV 类模型接入 | `ModeScorer` 接口已就绪，命令层零改动；合规通道论证见 §2 注 | 后续增强 |
| U4 | 3082 安装 + **浏览器端到端实测**（点开插件详情页看到配置区 → 改参数 → 保存 → `/router-preset` 行为随之改变） | `pnpm check` 只覆盖产物接线 + host 逻辑 + REST 面，**不能替代浏览器实测** | 待用户授权安装并重启后验收 |
| U5 | `routerSettings` 被手改成越界值时：运行值回落 0.6 且 loader 打 warning（`_commitVolatile` 语义），但用户层仍留着非法值 → **配置卡片会如实显示这个越界值**（不粉饰），而 `/router-preset` 的阈值回显是 60.0%（以回落值为准） | 无功能影响；仅"卡片显示值 ≠ 运行值"这一处观感差异 | 已知取舍，不计划修；保存一个合法值即覆盖 |

## 7 参考

- `docs/REQUIREMENTS.md` v0.5.1（需求→决策→实现→验收原始记录）
- `docs/specs/001-switch-preset/spec.md`（切换语义基线）
- 工作区铁律：`dsh-plugins/AGENTS.md`（禁自调 LLM API、单一真源、设置命名空间 = profile 条目 id）
- 上游契约：`packages/interaction/commands/src/index.ts`（命令 handler 不发模型消息）、
  `packages/client/ui-conversation/src/client/contract/slots.ts`（`SessionStandardProps.inputActions` / `useInput`）、
  `packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx`（`plugins.bundle.config` 的键 = 包名、`view:'page'`）、
  `vendor/schemastery/src/index.ts`（`.volatile()` 语义：`.get()` 读稳定引用）、
  `vendor/loader/src/config/entry.ts`（`_commitVolatile`：非法 volatile 值只告警、不崩、不落值）
