# CHANGELOG

## 0.5.1（2026-09-28）— 两个路由参数真实可配 + 插件页原生配置区（闭合 spec 002 U1）

- **需求依据**：更早一轮用户原话「并在插件设置页面可设置开启或关闭是否识别后执行切换」
  （spec 002 记为未决项 U1，本轮结项）+ 本轮要求「阈值可配、上下文校验、非法值不得崩溃」。
- **新增两个真实可配参数**（写在 profile 条目 `switch-preset` 的 volatile 字段 `routerSettings`）：
  | 参数 | 默认 | 范围 | 语义 |
  |---|---|---|---|
  | `routerEnabled` | `true` | 布尔 | 关闭时 `/router-preset` **只做概率判定与展示，不切换、不投递**，输出明确写"自动切换已关闭" |
  | `routerThreshold` | `0.6` | `0`–`1` | 达阈值才自动切换（语义不变）；越界/非数由 host 侧回落 0.6 |
- **Host**：
  - `src/host/route.ts`：`routePreset()` 第 5 参由裸阈值改为 `RouteOptions`（`Partial<RouterSettings>`）；
    新增 **判定后、切换前** 的 `routerEnabled=false` 早返回分支（不调用 `switchPreset`、不投递）；
    参数在最前面经 `normalizeRouterSettings` 归一化，任何非法输入都不抛错；
    `DEFAULT_ROUTE_THRESHOLD` 仍为 0.6 单一真源（下沉到 `src/shared/threshold.ts`，本文件再导出，保持既有导入路径）。
  - `src/host/settings.ts`（新增）：照 `dsh-minesweeper` 范式实现 0.1.7 原生设置面——
    读 `config.routerSettings.get()`、写 `settings.mutate(entryId, [{op:'set',path:['routerSettings',<key>]}], revision)`、
    监听 `loader/volatile-update`、自带 REST 数据面（`/api/dsh-switch-preset/settings` `GET|PUT`、`/settings/watch`）；
    写入前做阈值的 host 侧上下限校验（越界/非数 → 400 明确文案）。
  - `src/host/command.ts`：组装时经 `GetRouterSettings` 惰性读取参数（设置面缺失 → 出厂默认，命令永远可用）。
  - `src/index.ts`：导出 `Config`（`routerSettings` volatile 字段）；`webServer` 走二级注入 + `efect` 注册路由
    （静态 `inject` 仍为空数组——把 `commands`/`webServer` 写进静态 inject 会让 apply 永不执行，v2.0 事故）。
- **Client**：新增 `src/client/settings-card.ts` + `src/client/settings-api.ts`；`src/client/entry.ts` 注册
  `plugins.bundle.config`（**key = 包名 `dsh-switch-preset`**，上游只在该包名注册过时才渲染配置区）；
  卡片含「自动切换」开关 + 「判定阈值」数字框 + 保存/恢复默认 + 失败明确文案（含服务端原因），
  CSS 全走 `--dsw-*` token，异步全带超时。
- **构建门禁**：`scripts/build.mjs` 增补 `plugins.bundle.config` 插槽断言与 **key = 包名** 断言
  （key 写错会静默不显示，属高危静默失败）；`test/smoke-test.mjs` 增补 `Config` 导出、volatile 字段、
  静态 inject 为空数组、配置区接线共 6 条断言。
- **测试**：`test/router-test.mjs` 15 → **22 项**（新增：默认参数不变、关闭自动切换不切换不投递且文案说明、
  关闭+无原话零副作用、阈值 0.99 生效不切换、阈值 0 生效照旧切换、非法阈值回落 0.6 不崩、参数对象字段级回落）；
  新增 `test/settings-test.mjs` **25 项**（归一化/边界+回落、写入校验与 ops 形状、门面读/写/watch、
  REST GET/PUT/坏 JSON/405/watch 下限、Config schema 形状、**配置卡片 6 项**：控件渲染/保存提交两字段/
  越界前端拦截/失败文案带服务端原因/数据面不可用降级/热同步跟随新 revision）。
- **验证**：`pnpm check` 全绿——双端打包 + 产物门禁 + 双 tsconfig typecheck +
  5 组测试（冒烟 / switch / picker / router 22 / settings 19）。tgz 文件名 `dsh-switch-preset-0.5.1.tgz`。
- **知识记录（依赖口径）**：本插件 `package.json` 的 `@deepseek-ai/schemastery` 为 `>=3.18.0 <4.0.0-0`，
  而 `.volatile()` 在 **3.18.3 起**才有；本机 `node_modules` 曾残留 3.18.2（lockfile 已是 3.18.4），
  表现为 `TypeError: ....default(...).volatile is not a function`。处置：`pnpm install --frozen-lockfile`
  对齐 lockfile（**不改锁文件、不改上游**），不写版本探测分支。

## 0.5.0（2026-09-28）— `/router-preset` 概率路由：判定 → 切换 → 原话投递

- **需求原话**（用户 2026-09-28）：「如果不给答案可以给出判定某个模式命中的概率，概率第一高的就是要切换的
  类似 jev 模型」+「就是落到 /router-preset xxx 这个指令里面。等于是这条指令触发 preset 概率判定 +
  switch preset 操作 + 用户原本内容在切换后的 preset 模式下的后续输入 agent 交互」。
- **新增 `/router-preset <你的原话>`**（Host 命令）：
  1. **概率判定**：对 roster 中全部可用模式算出命中概率分布（归一化 sum=1，按概率降序），
     输出含每个模式的命中词（可解释，非黑箱）；
  2. **阈值决策**：Top-1 概率 ≥ **0.6**（`DEFAULT_ROUTE_THRESHOLD`）→ 切换；
     < 0.6 → **不切换**，只展示分布并提示 `如确认切到 X：/switch-preset <id>`（避免低置信度切错模式）；
  3. **切换**：**复用** `switchPreset()`（切换语义单一真源：select → recompose → 写默认四级降级），
     本版本不复制切换逻辑；
  4. **原话投递（Host 侧）**：切换成功后由 core 服务
     `sessionController.prompt({mode:'queue', content:[{type:'text',text:原话}]})`
     把原话投进该会话的用户输入队列；会话日志里是一条 `role:"user"` 的普通用户消息，
     随后 `turn/start` 在新模式下处理它（实测见下）。
     **为何不用"客户端接力"**（最初设想，已推翻）：客户端没有任何公开钩子能观察
     "用户键入的命令"结果（`hooks.notices` 属 package-private 且 composer 插槽为 single），
     客户端接力只能覆盖插件自己发起的调用，覆盖不了用户直接键入 `/router-preset xxx` 的主路径。
- **概率引擎可插拔（JEV 接入点）**：`ModeScorer` 接口是唯一打分入口；当前实现
  `LocalModeScorer`（engine id `local-keyword-v1`）：强特征表（人工提炼高区分度动作/交付物词，权重 3）
  + 从各模式 name/description 自动派生的弱特征（权重 1）+ 均匀先验，归一化为概率。
  将来接入 JEV 类模型只需实现同一接口（`score(candidates, utterance, threshold) → ScoreBoard`），
  命令层与客户端**零改动**。
- **上游契约依据**（`deepseek-harness` 源码，非猜测）：
  - `packages/interaction/commands/src/index.ts`：`CommandDefinition.handler` 注释明确
    "Execute against the receiving agent **without sending the command to the model**"，
    且 `CommandResult` 仅 `{kind, text, sourceEventSeq}`（不可扩展）→ 这是"投递必须另起一次
    prompt 调用"的原因；`sessionController` 正是该调用唯一公开通道。
  - `packages/client/ui-conversation/src/client/contract/slots.ts`：`SessionStandardProps.inputActions`
    （`setDraft` + `submit`）是会话作用域插槽可用的公开输入通道。
- **客户端 UI**：composer 工具行「⇄」弹层**置顶新增**「⚡ 按内容自动判定模式」
  （取输入框当前内容作为原话执行路由）；未达阈值时在同一位置展示概率明细（说明"为什么没切"）。
- **3084 实测（2026-09-28，含真实 6 模式 + agent-presets 实体）**：键入
  `/router-preset 帮我把这个项目做成一个演示视频，需要配音和字幕` →
  判定「视频模式 80.3%（命中：视频、配音、字幕、演示视频、项目、演示）」→
  `agent-preset/selected{agentPreset:video}` → `agent/inbox/spliced`（原话以 `role:"user"` 入队）→
  `turn/start` + `system/message` 显示**视频模式**人设 → `user/message` 为原话原文。
  唯一 `turn/end` 错误为 `MISSING_CREDENTIAL`（测试 home 未配 API key，属环境）。
- **冒烟/单测**：新增 `test/router-test.mjs` **15 项**（概率分布归一与降序、四类输入的判别力、
  阈值行为、达阈值→切换+投递原话、未达阈值→零副作用、切换失败→不投递、通道缺失/被拒/抛错三态、
  无判别力时不推荐任意模式、空原话报用法）；`pnpm check` 全绿（构建门禁 + 双 tsconfig + 4 个测试文件）。

## 0.4.1（2026-09-25）— 模式菜单改用 DSH 原生 Menu

- 弹层改用框架 `Menu`（向上展开、右缘对齐、portal 避免裁剪），恢复主题背景、键盘导航与焦点返回。

## 0.4.0（2026-09-23）— harness 0.1.7 原地对齐（无兼容垫片）

- **背景**（用户原话）：「因为新版本的dsh preset模式管理方式变了…一定要贴和dsh现在能力，不要补丁，要原地更新」；
  现场症状：`/list-preset` 毫无输出。
- **上游已核实的变化**（依据 `deepseek-harness/packages/preset/agent-preset-registry/src/` 与
  `packages/settings/settings/src/`，均为 0.1.7-alpha.2 源码）：
  1. roster 行字段是 `name`（不再是 `displayName`）；`list()` 仍是异步数组，而
     `remoteExportList()`（客户端 `remote.agentPresets.list()` 的宿主实现）返回
     `{ presets, modeSelectionEnabled }`——清单与策略的单一真源。
  2. 「默认模式」不再属于任何 `agent-presets` 设置命名空间（0.1.7 无此条目，写它会抛
     `No configurable plugin entry`）；它是内置条目 **`agent-preset-registry`** 的 volatile 字段
     **`selectedDefault`**，经 `ctx.settings.mutate(entryId, [{op:'set',path:[…]}], revision)` 写。
  3. 注册表策略 = `modeSelectionEnabled ? selectedDefault ?? default : default`：
     开关关闭时写 `selectedDefault` **不生效**，必须显式失败而不是假报成功。
- **实现**（原地更新，未引入兼容分支）：
  - `shared/contracts.ts`：roster/策略契约改为 0.1.7 形状（`PresetRoster`、`name`、字符串 `broken`）。
  - `host/command.ts`：默认模式写入改为 `settings.describe()` 定位注册表条目（不硬编码 id，回退内置 id）
    + `settings.mutate('…', [{op:'set',path:['selectedDefault'],value:id}], revision)`。
  - `host/switch.ts`：清单与默认标注统一走 `remoteExportList()`；`modeSelectionEnabled=false` 时
    降级路径直接给出解释性错误（不制造无效写入）。
  - `client/entry.ts` + `client/ui.ts`：`remote.agentPresets.list()` 改为读 roster 对象
    （`presets` + `modeSelectionEnabled`），弹层显示模式选择开关状态；行标题用 `name`。
  - 命令注册改为二级注入（`ctx.inject(['commands','agentPresets'], cb)`），不再把 `commands`
    写进插件级静态 `inject`——见 docs/TROUBLESHOOTING.md 的 0.1.7 条目。
- **测试**：`test/switch-test.mjs` 夹具同步到 0.1.7 契约，并新增「modeSelectionEnabled=false」用例；
  `pnpm check` 全绿。
- **已知未闭环（如实记录）**：在隔离实例（独立 DSH_HOME + 独立端口）上实测，本插件的宿主模块
  **被 import 了但 `apply` 从未执行**（模块级插桩有日志、`apply` 首行插桩无日志），
  同批的 sidebar-hub / global-auth / agent-platform-connector 均正常 apply。已排除：命令重名、
  inject 门控（`inject=[]` 仍不执行）、条目级 inject/config、link↔tgz 安装方式、条目被 disabled。
  详见 docs/TROUBLESHOOTING.md「0.1.7 挂载异常」条目（含复现步骤）。

## 0.3.0（2026-09-18）— 已开始会话「强制切换」模式

- **需求**（用户原话）：「我希望当前已经是xx模式的会话可以变更yy模式，当前会话已经有历史会话了，总之我要这样」。
- **实现**：`/switch-preset <id>` 对已开始会话不再只是写默认模式——**优先强制重装配**
  （`ctx.agentPresets.recompose(agent.ctx, id)`，该 API 无空会话锁定检查）+ 写入
  `agent-preset/selected` 事件保持投影/header 一致（重启后按新模式重建）。
  切换后当前会话（含既有历史）立即换模式，留在当前会话。
- **风险与提示**：模式切换会更换会话工具集/prompt 组成，历史中旧模式独有工具调用
  可能无法在新模式解析（DSH 框架默认禁止换 preset 的原因）；指令文本会附警告。
- **降级链**：recompose 不可用（宿主未提供）→ 写默认模式（0.2.x 行为）→ 均不可用 → 明确报错。
- 版本 0.2.1 → 0.3.0（四处同步）。

## 0.2.1（2026-09-18）— 修复「设置服务不可用」+ client 产物门禁加固

- **现象**（用户实测）：已开始会话执行 `/switch-preset <id>` 报「当前会话 preset
  已锁定；且设置服务不可用，无法改默认模式」——降级路径（写 `agent-presets.default`）失效。
- **根因**：`buildSwitchDeps` 用 `ctx.get('settings')` 取 settings 服务；cordis 的
  `get` 取不到**未声明**的服务（返回 undefined，实测复现）。官方姿势是
  `ctx.inject(['settings'], cb)` 二次注入。
- **修复**：`src/index.ts` apply 内 `ctx.inject(['settings'], cb)` 捕获服务实例；
  `src/host/command.ts` 改为**命令每次执行时惰性解析** settings（服务可能晚于 apply
  就绪）；服务缺失时仍按原设计明确报错而非静默成功。
- **附带加固**（AGENTS.md 2026-09-18 事故防线）：`scripts/build.mjs` 门禁增加
  client 产物「无顶层 import/export + `node --check`」断言（防 combo script 全批
  不执行事故）。
- 版本 0.2.0 → 0.2.1（四处同步）。

## 0.2.0（2026-09-17）— 切换语义变更 + 新增 /list-preset

**破坏性语义变更**（依据用户实测反馈，见 `docs/REQUIREMENTS.md` v1.1）：

- **`/switch-preset <id>` 改为「留在当前会话」**：
  - 会话**未开始**（空会话）→ `ctx.agentPresets.select` **就地换模式**，当前会话不跳转；
  - 会话**已开始**（框架锁死 `agent-preset/locked`）→ 把该模式写为**默认模式**
    （`agent-presets.default`，对之后新建的会话生效）+ 明确提示当前会话 preset 固定。
- **新增 `/list-preset`**：列出全部可用模式的 **preset id + 中文名 + 中文描述**
  （来源各 preset 的 `preset.yml` `name`/`description`），并标注当前会话模式与默认模式。
- `/switch-preset` 无参 = `/list-preset`（同一渲染源）。
- **移除**：`inheritHistory` 设置项与设置卡（不再创建新会话，设置失去意义）；
  切换后自动跳转（不再产生新会话）；`sessionController.create/fork` 依赖。
- 模式选择器（composer 🔄）保留：弹层展示中文名/描述/默认标注，点选经
  `remote.commands.execute('/switch-preset <id>')` 复用命令通道。
- 版本：0.1.0 → 0.2.0（四处同步：package.json / src VERSION / tgz 名 / README）。

## 0.1.0（2026-09-17）

- 首个可用版本。规格：`docs/specs/001-switch-preset/`（AC-1~AC-11）。
- Host：`/switch-preset` 命令注册（`ctx.commands`）；无参列出当前模式 + roster；带参按
  设置 `switchPreset.inheritHistory` 执行 `sessionController.create`（不继承，默认）或
  `fork`（继承）；目标 preset 校验（存在且非 broken）；fork 无可复制回合给出明确错误。
- 设置：`ctx.settings.installSection` 注册 `switchPreset` 命名空间 + client 设置卡
  `settings.plugin.item`（「历史上下文是否继承」开关）。
- Client：`command/executed` 监听自动跳转新会话（`sessions.open` 保引用调用，降级为文本提示）；
  模式选择器 `conversation.input.right`（🔄 按钮 + roster 弹层，点选经 `remote.commands.execute`
  复用命令通道）。
- 测试：switch 纯逻辑 8 组单测、session-jump 5 组单测、产物门禁（双端导出/插槽/命令名断言）、
  冒烟（版本四处同步）。
- 已知限制见 README「已知限制」。

> 0.1.0 的历史决策保留在本文件与本目录 docs/（README 只呈现当前行为）。
## 0.4.1 · 2026-09-25

使用 DSH 原生 Menu，向上展开、右缘对齐、portal 避免裁剪；恢复主题背景、键盘导航、焦点返回。
