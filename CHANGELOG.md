# CHANGELOG

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
