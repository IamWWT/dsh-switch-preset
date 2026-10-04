---
title: REQUIREMENTS — dsh-switch-preset 需求演进记录
type: requirements
status: active
version: 1.0.0
date: 2026-09-16
owner: AI + 用户
applies_to: dsh-switch-preset
---

## 当前状态

- 文档性质：需求演进真源（需求→决策→实现→验收）
- 对应版本：v0.6.1（2026-10-05）
- 状态：有效（如与实现不符，以代码与 `docs/REQUIREMENTS.md` 为准）
- 维护者：AI + 用户


# REQUIREMENTS — 需求演进单一事实源

> 每轮需求/反馈 → 决策 → 实现落点 → 验收，按时间记录。原始需求/规格见
> `docs/00-request/request.md` 与 `docs/specs/001-switch-preset/spec.md`。

## v0.6.1（2026-10-05，用户反馈：配置页帮助说明与可设置内容不完整）

- **用户原话**：「插件详情设置页面没有完整的帮助说明，和可设置内容。需要显式有」
- **问题（对照现状）**：
  1. 配置卡片只有「自动切换 + 判定阈值」两个控件，没有任何帮助说明；
  2. v0.6.0 新增的 `kbRoot`（/router-preset-memory 的知识库根目录）已在 Config schema
     声明，但**配置卡片没有该输入项**，host 写入白名单也不含它——用户无法在设置页配置
     kbRoot，只能手改 profile，与「显式有」的要求不符。
- **决策（v0.6.1）**：
  1. **帮助说明区块**：卡片顶部新增「命令与使用说明」——三条命令用途 +
     `/router-preset-memory`（记忆路由，kbRoot 语义）+ 未达阈值行为（判定详情投递到当前模式）
     + 关闭自动切换的后果，全部用主题 token、与卡片同字体层级。
  2. **kbRoot 纳入设置面可配**：卡片新增「知识库路径（kbRoot）」文本框（可留空 =
     DASH_KB_HOME/自动回退）；host `buildWriteOps` 白名单加 `kbRoot`（必须是字符串），
     ops 路径为独立 volatile 字段 `['kbRoot']`（不是 routerSettings 对象内）；REST GET 的
     value 一并返回 `kbRoot`；`loadMemoryContext` 的 kbRoot 读取走同一配置字段
     （config.kbRoot，volatile），配置卡保存即写 profile 条目配置，无需重启生效。
- **验收（用户可感知）**：插件详情页打开后能看到：① 帮助说明区块（含 4 条命令用途、
  阈值与开关语义、未达阈值行为、kbRoot 指向 dsh-kb 的说明）；② 设置项共 3 个——
  「自动切换」「判定阈值」「知识库路径（kbRoot）」，保存后 `/router-preset-memory`
  确实按新 kbRoot 读记忆（留空则走自动回退，命令不失效）。

## v0.6.0 补充（2026-10-05，用户现场反馈 B1：未达阈值时判定详情不可见）

- **用户原话**：「现状的 /router-preset {用户描述} 在新会话下发起时，如果判定分派概率小于阈值
  没有触发时，页面直接不展示对话和输出，也看不到详细的判定详情，我需要看到。」
- **现象**：新会话（空会话）下输入 `/router-preset <原话>`，判定未达阈值（不切换、不投递）时，
  命令**有返回文本**（判定分布+原因），但 Web 页面既不显示对话、也不显示任何输出。
  达阈值路径正常（因为投递了原话，模型回复触发渲染）。
- **影响面**：不止 `/router-preset`——推断所有「纯返回文本、不投递」的命令结果
  （`/list-preset`、`/switch-preset` 无参、未达阈值分支）在空会话下都可能不可见。
- **决策**：先读上游命令结果渲染链路定位根因（可能客户端无命令结果订阅 / 结果需随会话 turn 渲染 /
  空会话无渲染载体），选**最小的公开契约合规修复**；不 monkey patch（铁律）。
- **根因（2026-10-05 上游代码实证，闭环）**：未达阈值分支只返回 `CommandResult`（不投递任何会话事件）
  → host blank 状态机只认 `turn/start` 翻转 blank（`session-controller/src/list.ts:49`
  `blank = state.blank && event.type !== 'turn/start'`）→ client 装配 command 节点但 chat 视图
  `isActive` 要求存在非 command 节点（`ui-chat/chat-snapshot-builder.ts:1206`；测试明确断言
  command-only history 对 shell **inactive**）→ `ui-conversation/assembly.ts:174` 的 activeTargets
  实为 isActive 过滤后的集合 → `DefaultConversationViews.tsx:35` 对 blank 会话返回 null →
  **页面空白**。即上游 blank 会话设计让「纯命令结果（无 user/assistant 事件）」在新会话不可见，
  不只 router-preset（/list-preset 同理）。
- **修复决策（2026-10-05 用户确认）**：未达阈值时**投递「判定详情 + 原话」到当前模式继续**
  （不切换模式，投递内容带判定详情）。投递必然产生 `turn/start` → blank 翻转 → 页面渲染，
  用户能看到判定详情且原话在当前模式下被正常处理。语义变更：v0.5.1「未达阈值不投递」
  → v0.6.0「未达阈值不切换、但投递判定详情+原话到当前模式」。`enabled=false`（自动切换关闭）
  分支**不投递**（用户显式关掉的场景尊重开关：只判定展示）。
- **验收**：新会话下 `/router-preset <低置信度原话>` 必须在页面看到完整判定详情（模式命中概率+
  阈值判定+未切换说明）且原话被当前模式继续处理；达阈值路径行为不变；`/list-preset` 等纯文本命令
  新会话下仍不可见（上游设计，不在本修复范围）。

## v0.6.0（2026-10-05，记忆路由 `/router-preset-memory`：切模式后渐进式加载 dsh-kb 记忆）

- **用户原话（本轮）**：「（1）更新dsh插件 router-preset … #1 用户需求处理：新开Session …
  2，记忆加载判定：XX preset模式下，/router-preset-memory {用户原话}
  输出：system prompt中渐进式根据需求加载记忆：个人记忆、选择项目记忆、选择性会话记忆。」
  ——即 `/router-preset`（v0.5.x 已有：概率判定→切换→投递原话）的**记忆增强版**：
  切换成功后，把相关 dsh-kb 记忆（L1 个人记忆 → L2 项目记忆 → L3 会话记忆）随原话一起投递，
  让切换后模式下的 agent 一开始就有上下文。
- **需求溯源**：用户提供「记忆路由指导文件」（#0 记忆分层 + #1 新开 Session 流程）要求落 dsh-kb
  （`00-索引/记忆路由指导.md`，2026-10-05 入库）；本版本在插件侧落地第 2 步。
- **设计决策**：
  1. **复用不重写**：`/router-preset-memory` 复用 `routePreset()` 的判定→切换流水（单一真源），
     仅通过**可选第 6 参 `enrich`** 把「投递内容」从纯原话替换为「记忆上下文 + 原话」——既有
     调用方（`/router-preset`）不传该参，行为与语义零变化（v0.5.x 全部测试原样通过）。
  2. **记忆加载是纯文件读取**（铁律 #3 不调 LLM）：`src/host/memory.ts` 只读 dsh-kb 文件拼文本，
     由命令行把拼接结果交给现有 `deliverUtterance`（sessionController.prompt，走 DSH 自己的 agent 循环）。
  3. **kbRoot 解析复用工作区约定**（daily-workbench 同范式，不依赖其他插件——铁律 #2 禁插件互依）：
     配置 `kbRoot` 字段 > `DASH_KB_HOME` 环境变量 > 模块位置推导 `<DEEPSEEK_ROOT>/data/dsh-kb`
     （源码树态）> profile 依赖反推（安装态）> `~/dsh-kb`（历史兜底）。
  4. **渐进加载与限量**（对齐 dsh-kb L0-L5 协议）：L1 `01-偏好/人物画像.md`（档案区，≤100 行）；
     L2 `02-项目/*.md` 按原话关键词匹配（≤2 张卡，各 ≤40 行）；L3 `04-每日/` 最近 3 天（各取事实/决策小节
     节选）。找不到知识库/命令执行失败 → **明确告知未加载记忆，不阻塞**（照常切模式+投递原话）。
  5. **不硬编码机器路径**：所有路径经 `node:os/node:path` 解析；测试用临时目录造假 dsh-kb 跑纯逻辑。
- **实现落点**：
  1. `src/shared/contracts.ts`：新增 `MEMORY_ROUTER_COMMAND_NAME = 'router-preset-memory'`；
     `MemoryContextResult` 形状（`{ ok, summary, context }`）。
  2. `src/host/memory.ts`（新增）：`resolveKbRoot(cfg)`（四层回退）+ `loadMemoryContext(kbRoot, utterance)`
     （L1/L2/L3 渐进加载，限量截断）。
  3. `src/host/route.ts`：`routePreset()` 新增**可选** `enrich?: (utterance: string, topId: string) =>
     Promise<{ summary: string; context: string }>`；投递前若传入则内容改为拼接记忆上下文，
     回显附 `summary`（加载了哪些层）。既有调用零改动。
  4. `src/host/command.ts` + `src/index.ts`：注册 `/router-preset-memory`（同判定+切换，投递带记忆）；
     `Config` 增加 `kbRoot` 字段（与 daily-workbench 同 schema 范式）。
  5. `test/memory-test.mjs`（新增）：临时目录造 dsh-kb → 断言 L1 必载、L2 关键词命中/限量、
     L3 取近 3 天、kb 缺失降级不阻塞。
- **验收**：
  - `pnpm check` 全绿（含新增 memory 测试组；既有 5 组测试全数通过，证明 `/router-preset` 语义未变）；
  - `loadMemoryContext` 单测：有效 kb + 「继续 veinmap 项目」→ context 含人物画像档案区 + veinmap 卡 +
    最近日记；无匹配词 → 只有 L1；kbRoot 无效 → `{ok:false}` 且不抛。
  - **未做/未验证**：tgz 安装 + 3082/3084 实例浏览器端到端（需用户授权装包并重启后验收）。

## v0.5.1（2026-09-28，路由参数可配 + 插件页原生配置区）

- **用户原话（本轮）**：「给 dsh-switch-preset 加上真实可配参数，并注册到 DSH 插件页的原生配置区，
  使其在『左侧栏 → 插件 → 点进 dsh-switch-preset 详情页』能看到参数」；
  参数口径：① `routerEnabled`（默认开）：关闭时 `/router-preset` **只做概率判定与展示，不切换、不投递**，
  输出里明确说明"自动切换已关闭"；② `routerThreshold`（默认 0.6，范围 0–1）：达阈值才自动切换，
  语义不变，**上限/下限校验在 host 侧做，非法值不得导致崩溃**。
- **需求溯源**：更早一轮原话「并在插件设置页面可设置开启或关闭是否识别后执行切换」= spec 002 未决项 U1，
  **本版本结项**。
- **实现落点**：
  1. `src/shared/router-settings.ts`（新增）：`RouterSettings` 类型 + `Config` schema（volatile 字段
     `routerSettings`）+ `normalizeRouterSettings()`（缺字段补默认、非法阈值回落 0.6）+ 边界常量；
     `src/shared/threshold.ts`（新增）：`DEFAULT_ROUTE_THRESHOLD = 0.6` 单一真源（避免与 `route.ts` 成环）。
  2. `src/host/route.ts`：`routePreset()` 第 5 参 → `RouteOptions`；新增 **判定后、切换前** 的
     `routerEnabled=false` 早返回（不 `switchPreset`、不投递，文案说明已关闭 + 手动切换指引）。
  3. `src/host/settings.ts`（新增）：0.1.7 原生设置面门面（读 volatile / `settings.mutate` 写 / watch）
     + REST 数据面（`/api/dsh-switch-preset/settings` `GET|PUT`、`/settings/watch`）+ host 侧阈值校验。
  4. `src/host/command.ts` + `src/index.ts`：组装期惰性读参数；导出 `Config`；`webServer` 二级注入注册路由
     （静态 `inject` 保持 `[]`）。
  5. `src/client/settings-card.ts` + `src/client/settings-api.ts`（新增）+ `src/client/entry.ts`：
     注册 `plugins.bundle.config`（key = 包名），卡片含开关 + 阈值数字框 + 保存 + 失败明确文案。
- **验收**：
  - `pnpm check` 全绿（双端打包 + 产物门禁 + 双 tsconfig + 5 组测试：
    冒烟 / switch / picker / router **22 项** / settings **25 项**）；
  - 关闭自动切换：`/router-preset` 仍输出完整概率分布，`select`/`recompose`/`writeDefault`/`deliver` 调用数均为 0（单测断言）；
  - 阈值可配生效：0.99 → 原本达阈值的输入不再切换；0 → 照旧切换并投递；非法值
    （-0.5 / 1.5 / NaN / Infinity / '0.7' / null / undefined）→ 回落 0.6 且不崩；
  - host 侧校验：越界/非数写入 → REST 400 + 明确文案，且不触碰 `settings.mutate`；
  - **未做/未验证**：3082/3084 实例内的**浏览器实测**（点开插件详情页看配置区、点保存后 `routerEnabled`/`routerThreshold`
    真正改变 `/router-preset` 行为）本轮未执行——`pnpm check` 只覆盖到"产物接线 + host 逻辑 + REST 面"，
    端到端需安装 tgz 并重启后由用户验收（见 spec 002 §6 U4）。

## v0.5.0（2026-09-28，概率路由 `/router-preset`）

- **用户原话**：「如果不给答案可以给出判定某个模式命中的概率，概率第一高的就是要切换的 类似 jev 模型」
  +「就是落到 /router-preset xxx 这个指令里面。等于是这条指令触发 preset 概率判定 + switch preset 操作 +
  用户原本内容在切换后的 preset 模式下的后续输入 agent 交互」。
- **澄清决策**（用户确认）：
  1. 概率引擎：**先落本地确定性打分**（零依赖/可单测/离线可用），接口做成可插拔，
     将来接入 JEV 类模型时命令层与客户端零改动；
  2. 阈值：Top-1 ≥ **0.6** 才自动切换；低于阈值**只提示不切换**（避免低置信度切错模式）；
  3. 原话接力机制：先按"客户端接力"设想实现 → **实测推翻**（见下"实现落点"第 4 条），改为 Host 侧投递。
- **实现落点**：
  1. `src/host/router.ts`：`ModeScorer` 接口 + `LocalModeScorer`（engine `local-keyword-v1`）；
     强特征表（人工提炼高区分度词，权重 3）+ 各模式 name/description 自动派生弱特征（权重 1）+
     均匀先验 → 归一化为概率；输出含**命中词**（可解释）。
     `undetermined`（全部并列）标记：无判别力时不得给"冠军"推荐。
  2. `src/host/route.ts`：三步编排（判定 → 复用 `switchPreset` 切换 → 投递）；
     切换失败**不投递**；投递通道缺失/被拒/抛错三态均如实回显"未投递"并指导手动重发。
  3. `src/host/command.ts`：注册 `/router-preset`（三条指令并列）；
     `buildSwitchDeps` 新增 `deliverUtterance`（core 服务 `sessionController.prompt`，**不调用任何模型 API**）；
     `src/index.ts` 二级注入 `sessionController` 并惰性解析。
  4. **投递通道的实测结论（重要）**：上游命令 handler 明确"不把命令发给模型"
     （`packages/interaction/commands/src/index.ts`），`CommandResult` 只有
     `{kind,text,sourceEventSeq}`；客户端**没有公开钩子**能观察"用户键入的命令"结果
     （`conversation.composer.bar` 的 `hooks.notices` 是 package-private 且插槽为 single 已被占用）。
     故"客户端接力"只能覆盖插件自己发起的调用，覆盖不了主路径 → 投递落在 Host 侧。
  5. 客户端：模式菜单弹层置顶「⚡ 按内容自动判定模式」（取当前草稿为原话，`useInput` standard hook 读取）；
     只负责展示 Host 返回的判定与投递实况，不再接力。
- **验收（3084 隔离实例，2026-09-28）**：`pnpm check` 全绿（含 `test/router-test.mjs` 15 项）；
  真实 6 模式环境下键入 `/router-preset 帮我把这个项目做成一个演示视频，需要配音和字幕` →
  判定「视频模式 80.3%（命中：视频、配音、字幕、演示视频、项目、演示）」→ `agent-preset/selected{agentPreset:video}`
  → `agent/inbox/spliced`（原话以 `role:"user"` 入队）→ `turn/start` 且 `system/message` 为**视频模式**人设
  → `user/message` 为原话原文（唯一 `turn/end` 错误为 `MISSING_CREDENTIAL`，测试 home 未配 API key，属环境）。
  内置模式（standard/cordis/minimal/ptc）环境下正确输出"**无法判定**"且不切换、不推荐（无判别力）。
- **未决**：3082 安装待用户授权；JEV 类模型接入为后续可选增强（接口已就绪）。

## v1.0（2026-09-16，初始需求）

- **用户原话**：新建一个插件，用斜杠指令切换当前会话模式；切换后会话历史上下文是否继承可在设置中设置；插件名让 Agent 起；探索如何聪明识别 dsh 当前模式；尽量复用框架能力。
- **澄清决策**（用户确认）：
  1. 「会话模式」= DSH 的 Agent preset（复用官方概念）；
  2. 「切换」= 进入新会话（fork=继承历史 / create=干净上下文），原会话保留可切回；
  3. 指令名 `/switch-preset`（用户指定，非 `/mode`）；插件名 `dsh-switch-preset`；
  4. 继承模式下无法更换 preset（DSH 框架锁死）→ fork 复制会话并明确提示。
- **补充需求（规格确认环节用户提问）**：「模式 id 是什么？需要用户自己指定么，能自动弹出么？」
  → 决策：① 无参指令列出当前模式+可用模式（免记 id）；② 新增 client 模式选择器
  （composer 工具行按钮 → roster 弹层点选 → 复用命令通道）。落点：spec §3.3 + AC-11、tasks T4b。
- **实现落点**：Host `ctx.commands` + `ctx.sessionController.create/fork` + `ctx.agentPresets.list`；
  Client `settings.plugin.item` 卡 + `conversation.input.right` 选择器 + `command/executed` 跳转。
- **验收**：`docs/specs/001-switch-preset/spec.md` §4 AC-1~AC-11（临时实例 🔬 / 3082 🖥）。

## v1.1（2026-09-17，用户反馈：切换语义变更 + 新增 list-preset）

- **用户原话**：「不满意, 我需要的是指令后, 留在当前会话, 但是会话默认模式转为目标模式, 而且我加入指令后, 并没有带出我能用什么模式, 是否可以加一个/list-preset 来查看当前 /switch-preset 对应应填写的presetid, 注意list时候应该写明每个preset 对应中文描述(或者设置里面对应的描述)」
- **变更决策**：
  1. **切换语义**：不再 fork/create 新会话、不再自动跳转；`/switch-preset <id>` **留在当前会话**：
     - 空会话（未开始回合）→ `ctx.agentPresets.select(agent, id)` 就地换 preset；
     - 已开始会话（框架锁死 `agent-preset/locked`）→ `ctx.settings.update('agent-presets', { default: id })` 把该模式设为**默认模式**（之后新建会话生效）+ 明确提示。
  2. **新增 `/list-preset`**：列出全部可用 preset 的 **id + 中文名 + 中文描述**（来源 `preset.yml` 的 `name`/`description`），并标注当前会话模式与默认模式。
  3. **移除**：`inheritHistory` 设置项与 client 自动跳转（新语义不再创建会话，二者失去意义；避免纸面配置）。
  4. **保留**：`/switch-preset` 无参列表（与 `/list-preset` 同源）、composer 模式选择器（弹层显示中文名/描述）。
- **验收更新**：spec v1.1 AC-12~AC-16（见 `docs/specs/001-switch-preset/spec.md` 变更记录）。

## 变更记录

| 日期 | 变更 | 原因 | 验收 |
|------|------|------|------|
| 2026-09-16 | v1.0 初稿（含选择器增强） | 初始需求 + 规格确认期用户补充 | AC-1~AC-11 |
| 2026-09-17 | v1.1 切换语义改为"留在当前会话"+ 新增 `/list-preset` + 中文描述 + 移除 inheritHistory/自动跳转 | 用户实测反馈 | AC-1~AC-16 |