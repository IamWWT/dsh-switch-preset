---
title: Spec 001 — /switch-preset 会话模式切换
type: spec
status: draft
version: 1.0.0
date: 2026-09-16
owner: AI + 用户
applies_to: dsh-switch-preset
---

# Spec 001 — /switch-preset 会话模式切换

## 头部元信息

- 状态：**草稿**（待用户确认后转「已确认」）
- 版本：v1.0.0（2026-09-16）
- 确认记录：P0 三轮澄清已闭环（见 request.md「澄清记录」）；本 spec 呈现后用户确认即进入实现

## 1 背景与目标

用户原话（引用）："用斜/指令可以切换当前会话模式,切换后这个会话历史上下文是否继承可以在设置中设置……能复用框架本身的能力就复用,不要重复造轮子"

DSH 的"会话模式"官方概念 = **Agent preset**（新建会话的 Agent mode picker；会话创建后 preset 固定，仅空会话可换）。本插件用一个斜杠指令在会话进行中"切换模式"：以目标 preset 组成的新会话替换当前工作上下文，是否携带当前会话历史由设置控制。全部复用 DSH 既有机制，不重写任何会话/preset 逻辑。

## 2 范围

**吸收/复用（不重造轮子）**：

| DSH 机制 | 复用点 |
|---|---|
| `ctx.commands.register()` | 斜杠指令注册/分发/执行（不产生模型消息） |
| `ctx.sessionController.create()/fork()` | 切换动作本体（create=干净上下文+目标 preset；fork=复制历史） |
| `ctx.agentPresets.list()` | 模式清单与健康度（roster 单一真源，不硬编码） |
| `ctx.agentPresets.select()` | 不采用（带历史会话被框架锁死；create 已可直接指定 preset） |
| `ctx.settings.installSection` + client 设置卡 | 设置项「历史上下文是否继承」 |
| client `command/executed` 事件 + `uiWorkspace.openSession()` | 切换后自动跳转新会话 |
| session 投影 `agentPreset` | 识别当前模式（/switch-preset 无参展示） |

**自研范围**：仅薄胶水层——命令注册与参数解析、切换决策（按设置选 create/fork）、结果文本组装、client 跳转监听。

**非目标**：模式增删改管理（roster 自带）；plan mode 管理（DSH 自带 /plan）；改动官方 picker/roster；自建会话存储或 preset 复制逻辑；UI 主题定制（仅设置卡，走主题 token）。

## 3 形态与交互

### 3.1 指令

| 输入 | 行为 | 返回（kind: text） |
|---|---|---|
| `/switch-preset` | 展示当前模式 + 可用模式清单 | success：`当前会话模式：<id>（<display>）\n可用模式：...`（broken 标注） |
| `/switch-preset <presetId>`（inheritHistory=false，默认） | create 新会话（目标 preset、干净上下文） | success：`已切换到模式 <id>（display）：新会话 <sessionId>（不含历史）` |
| `/switch-preset <presetId>`（inheritHistory=true） | fork 当前会话（历史全带、preset 保持源会话） | success：`已复制当前会话为 <sessionId>（继承历史；DSH 限制：带历史会话不能更换 preset，模式保持 <当前id>）` |
| 目标 preset 不存在/broken | 不创建会话 | error：`模式 <id> 不可用（不存在或已损坏）` |
| 继承模式且无可 fork turn | 不创建会话 | error：`当前会话还没有可复制的对话（需至少一个已完成回合）` |

指令注册元数据：`name: 'switch-preset'`，`description: '切换会话模式（Agent preset）'`，`input: { hint: '<preset-id>' }`，`recordInput: true`。

### 3.2 设置项

命名空间 `switchPreset`（经 `ctx.settings.installSection`），唯一键：

| 键 | 类型 | 默认 | 语义 |
|---|---|---|---|
| `inheritHistory` | boolean | `false` | 切换时是否继承当前会话历史（true=fork 复制；false=create 干净） |

client 设置卡：`settings.plugin.item`（绑定 `switchPreset.inheritHistory`），开关控件，保存走 settings 文档更新。

### 3.3 模式选择器（client 弹出，用户补充需求 2026-09-16）

- 入口：`conversation.input.right` 插槽（composer 工具行，与既有插件 order 错开）加「切换模式」按钮（🔄 图标）；
- 点击弹出模式列表（`agentPresets/list` Remote 实时 roster：display name + description + broken 标注 + 当前模式打勾）；
- 选中某模式 → client 构造命令行 `/switch-preset <id>` → `remote.commands.execute(sessionId, line)` **复用 Host 命令逻辑**（校验/继承分支/跳转全走命令通道）；
- 不弹原生输入：`/switch-preset` 的 `input` 仅 hint（DSH 命令系统无参数选择器，已实证）；键盘流（打命令）与鼠标流（点选）双入口并存，共享同一 Handler。

### 3.4 数据流（切换一次）

```
composer /switch-preset <id>      （或 client 选择器点选 → 构造同一命令行）
  → Web adapter → Host ctx.commands.execute(agent, line)
    → handler: 读 config.inheritHistory
        ├─ false → sessionController.create({ agentPreset: id, workspaceId? }) → newId
        └─ true  → sessionController.fork({ sessionId }) → newId
    → 返回 { kind:'success', text:'... <newId>' }
  → Web UI 渲染文本 + client 插件 ctx.on('command/executed')
    → name==='switch-preset' && success → 解析 newId → uiWorkspace.openSession(newId)
```

### 3.5 识别当前模式（"聪明识别"）

- 当前模式：切换结果 create 返回的 `agentPreset` / 会话投影 `agentPreset`（无参指令经 handler 从当前 session 投影读取）；
- 可用模式：`ctx.agentPresets.list()`（display name/description/健康度，`broken` 标注）；
- 单一真源：模式清单永不硬编码，全部来自 roster。

## 4 验收标准（AC，逐条可测）

> 实例标注：🔬=临时实例（DSH_HOME 隔离 + 端口 3084）；🖥=3082 dev web（用户验收）

| # | 标准 | 实例 |
|---|---|---|
| AC-1 | `switch-preset` 出现在 `ctx.commands.list(agent)`；Web composer 输入可触发且不产生模型消息 | 🔬🖥 |
| AC-2 | 无参指令输出含当前会话 `agentPreset`，且可用列表与 `agentPresets.list()` 一致、broken 标注 | 🔬 |
| AC-3 | 设置卡「继承历史上下文」开关可读写 `switchPreset.inheritHistory`，默认 false | 🔬🖥 |
| AC-4 | inheritHistory=false：`/switch-preset <有效id>` create 新会话，新会话投影 preset=目标 id、事件流为空 | 🔬 |
| AC-5 | inheritHistory=false：`/switch-preset <无效id>` 返回 error、不产生新会话 | 🔬 |
| AC-6 | inheritHistory=true：`/switch-preset <id>` fork 新会话，事件流含源历史、投影 preset=源 preset；文本含"无法更换 preset"提示 | 🔬 |
| AC-7 | inheritHistory=true 且无可 fork turn：返回明确 error | 🔬 |
| AC-8 | 切换成功后 Web 自动跳转新会话（`command/executed` → `openSession`）；事件缺失时降级为文本提示不崩溃 | 🔬🖥 |
| AC-9 | `npm run check` 全绿（build 门禁含 host 导出断言、client 含插件 id 与两插槽断言） | 🔬 |
| AC-10 | 设置键只声明实际消费的键；无写死主题色值 | 🔬 |
| AC-11 | client 模式选择器：`conversation.input.right` 按钮可弹出 roster 列表（当前模式打勾、broken 标注）；点选后经 `remote.commands.execute('/switch-preset <id>')` 触发同一命令通道并完成跳转 | 🖥 |

## 5 迁移与运维

- 阶段顺序：M0 脚手架（已过）→ M1 Host 指令（AC-1/2/4/5/6/7）→ M2 设置（AC-3/10）→ M3 client 跳转（AC-8）→ M3b client 选择器（AC-11）→ M4 加固交付（AC-9 + 文档）
- 验证窗口：全程临时实例（`DSH_HOME=$HOME/.dsh-switch-preset-test` + 端口 3084）；**未发布改动禁止上 3082**（PLUGIN-DEV-STANDARD §7.3）
- 卸载/回滚：`dsh-dev plugin --profile web rm dsh-switch-preset`（3082）；配置残留 `switchPreset` 命名空间随插件卸载移除
- 兼容：DSH 0.1.x 预发布 API；服务形状集中于 `src/shared/contracts.ts` 单点适配，升级 dsh 后按 TROUBLESHOOTING 核对

## 6 待确认决策点（Clarify 结论回写）

| # | 决策点 | 候选 | 结论（2026-09-16） |
|---|---|---|---|
| D1 | 模式定义 | A preset / B 自定义 / C 混合 | ✅ A：复用 DSH Agent mode（preset） |
| D2 | 切换语义 | A 进新会话 / B 同会话 / C 只同会话 | ✅ A：切换=进新会话（fork/create），原会话保留 |
| D3 | 指令名与插件名 | 候选若干 | ✅ 指令 `/switch-preset`；插件 `dsh-switch-preset` |
| D4 | 继承模式下 preset 无法更换（框架锁死）的处理 | A 复制会话并明示 / B 拒绝 | ✅ A：fork 复制 + 文本明确提示 |
| D5 | 自动跳转机制 | A command/executed + openSession / B 文本提示手点 | ✅ A（H3 已验证事件存在）；B 为降级路径 |

## 7 依赖与风险

- 技术风险：
  1. `command/executed` 事件签名随 dsh 版本漂移 → 降级路径（AC-8 兜底）；单点适配集中在 client entry
  2. `create` 不带 workspaceId 时新会话落在 defaultCwd，可能不在当前 workspace 树 → 尝试从当前会话解析 workspace 传入；失败降级（H4）
  3. TS 工具链：npm 最新 TS7 与骨架脚本不兼容（已锁定 `>=5.0.0 <6.0.0`，实测 TS 5.9.3 通过）
- 与既有插件兼容：无冲突（新路由无、仅命令注册与设置命名空间 `switchPreset`，全局唯一）；与 ui-agent-preset 的 header 标签不冲突（不占用其槽位）
- 鉴权：不新增 HTTP 面，全部走既有 Remote/命令通道，无旁路
---

## 变更记录

### v1.1（2026-09-17，用户实测反馈）

**用户原话**：「不满意, 我需要的是指令后, 留在当前会话, 但是会话默认模式转为目标模式, 而且我加入指令后, 并没有带出我能用什么模式, 是否可以加一个/list-preset 来查看当前 /switch-preset 对应应填写的presetid, 注意list时候应该写明每个preset 对应中文描述(或者设置里面对应的描述)」

**变更内容**：

| 项 | v1.0 | v1.1 |
|---|---|---|
| 切换目标 | 进入新会话（fork/create） | **留在当前会话** |
| 空会话 `/switch-preset <id>` | create（干净上下文） | `agentPresets.select` **就地换模式** |
| 已开始会话 `/switch-preset <id>` | fork 复制（preset 不变） | 框架锁死 → **写默认模式**（之后新建会话生效）+ 明示 |
| 自动跳转 | `command/executed` → `sessions.open` | **移除**（不再产生新会话） |
| `inheritHistory` 设置 | 有（设置卡） | **移除**（不再创建会话，设置失去意义） |
| 模式清单 | 无参 `/switch-preset` | 新增 **`/list-preset`**（id + 中文名 + 中文描述 + 当前/默认标注）；无参 `/switch-preset` 同源 |

**新增验收标准（v1.1）**：

| # | 标准 | 实例 |
|---|---|---|
| AC-12 | `/list-preset` 列出全部可用模式，每项含 **preset id + 中文名 + 中文描述**（来源 `preset.yml`），并标注「当前会话」「默认」；损坏项单列 | 🔬🖥 |
| AC-13 | 无参 `/switch-preset` 输出与 `/list-preset` 一致 | 🔬 |
| AC-14 | 空会话执行 `/switch-preset <有效id>`：**就地切换**（`agentPresets.select` 成功），当前会话不变更 id、不产生新会话 | 🔬🖥 |
| AC-15 | 已开始会话执行 `/switch-preset <有效id>`：明确提示框架限制，并把该模式写入 `agent-presets.default`（默认模式生效于之后新建的会话）；当前会话模式不变 | 🔬🖥 |
| AC-16 | 目标不存在/损坏/id 格式非法 → error 且零副作用（不切换、不写默认）；`settings` 服务缺失时给出明确错误而非静默成功 | 🔬 |

**回归范围**：switch 纯逻辑单测（8 组）重写覆盖新矩阵；client 选择器保留但移除跳转与设置卡；产物门禁断言改为 `conversation.input.right` + 双命令名（`switch-preset`/`list-preset`）。
