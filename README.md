# dsh-switch-preset

DSH 会话模式切换插件：用斜杠指令 `/switch-preset` **在当前会话内**切换 Agent preset（DSH 的"会话模式"），用 `/list-preset` 查看可填写的模式 id 与中文描述，用 `/router-preset <你的原话>` **按概率自动判定该切哪个模式**并接着把你的原话在该模式下继续。

> 版本: 0.6.0 | 语言: TypeScript（Host + Client 双端）| 目标实例: Web GUI（3082 dev web / 临时实例）
> v0.6.0（2026-10-05）：**新增 `/router-preset-memory`（记忆路由）+ 修复新会话命令结果不可见（B1）**——
> ① `/router-preset-memory <原话>` 与 `/router-preset` 相同的判定→切换，但投递内容 = **dsh-kb
> 渐进加载的记忆（L1 个人画像 → L2 项目卡片 → L3 近 3 天会话日记）+ 你的原话**，切换后模式下的
> agent 开局即带相关记忆；知识库缺失/读取失败**不阻塞**（照常切换+投递原话，回显说明）。kbRoot 经
> 插件行配置 `kbRoot` 指定（volatile），未配置时自动回退（DASH_KB_HOME → 模块推导 → ~/dsh-kb）。
> ② 修复（B1，2026-10-05 用户现场反馈）：**新会话下 `/router-preset` 未达阈值时页面无任何输出**——
> 根因是上游 blank 会话只认 `turn/start` 翻转，纯文本命令结果在新会话不可见（已用上游代码+测试闭环）。
> 修复：未达阈值时**不切换模式，但把「判定详情 + 原话」投递到当前模式继续**，页面必然渲染判定详情，
> 原话也在当前模式下被正常处理（不会切错模式）。
> v0.5.1（2026-09-28）：**两个路由参数可配**（闭合 spec 002 未决项 U1）——在
> 「左侧栏 → 插件 → 点进 dsh-switch-preset」详情页的**配置区**可开关「自动切换」、可设「判定阈值」；
> 关闭自动切换后 `/router-preset` **只做概率判定与展示，不切换、不投递**（输出明确说明"自动切换已关闭"）；
> 阈值默认 0.6、范围 0–1，非法值（越界/非数）在 host 侧回落 0.6（不崩、不写坏配置）。
> v0.5.0（2026-09-28）：新增 **`/router-preset` 概率路由**——对全部可用模式算出命中概率分布，
> 概率最高者 ≥ 阈值（默认 **0.6**）即自动切换，并把你的原话作为**切换后模式下**的输入继续；
> 低于阈值只展示概率分布、**不切换**（避免低置信度切错模式）。概率引擎可插拔（当前本地确定性打分，
> 后续可接入 JEV 类模型输出）。
> v0.4.1（2026-09-25）：模式菜单改用 **DSH 原生 Menu**（向上展开、右缘对齐、portal 避免裁剪），恢复主题背景、键盘导航、焦点返回；
> v0.4.0（2026-09-23）：**harness 0.1.7 原地对齐**（roster 字段/策略对象、默认模式写入目标改为
> `agent-preset-registry.selectedDefault`、尊重 `modeSelectionEnabled`、命令改二级注入）；
> v0.3.0（2026-09-18）：对已开始会话支持 **recompose 强制切换**（含历史原地换模式）。语义演进见 `CHANGELOG.md` 与 `docs/REQUIREMENTS.md`。

## 功能一览

| 指令 / 入口 | 作用 |
|---|---|
| `/list-preset` | 列出全部可用模式：**中文名（preset id）** + **中文描述**，并标注「当前会话」「默认」与损坏项；同时给出用法提示 |
| `/switch-preset`（无参） | 等同 `/list-preset` |
| `/switch-preset <id>` | 切换当前会话模式（语义见下表），**留在当前会话** |
| **`/router-preset <你的原话>`** | **概率路由**：对全部模式算命中概率 → 最高者 ≥ 阈值（默认 0.6）就自动切换 → 你的原话在**切换后模式**下继续交互；未达阈值**不切换**，但把「判定详情 + 原话」投递到**当前模式**继续（v0.6.0，保证新会话下判定详情页面可见）；**关掉「自动切换」开关时只判定与展示** |
| **`/router-preset-memory <你的原话>`** | **记忆路由**（v0.6.0）：与 `/router-preset` 相同判定→切换，但投递内容 = **dsh-kb 渐进加载的记忆（L1 个人 → L2 项目 → L3 会话）+ 原话**，切换后模式开局带记忆 |
| id 从哪来 | 直接复制 `/list-preset` 里括号中的 id（如 `engineering`、`research`） |
| composer 工具行「⇄」按钮 | 弹出模式列表；**置顶项「⚡ 按内容自动判定模式」**＝对输入框当前内容执行 `/router-preset`，其余项点选即 `/switch-preset <id>` |
| 插件页配置区（v0.5.1） | 「左侧栏 → 插件 → dsh-switch-preset」详情页正文的两个参数：**自动切换**开关 + **判定阈值**数字框（含保存/恢复默认） |

### 可配参数（v0.5.1，插件页配置区）

| 参数 | 默认 | 范围 | 语义 |
|---|---|---|---|
| `routerEnabled` | `true` | 布尔 | **自动切换总开关**。关闭时 `/router-preset <原话>` 仍然照常做概率判定并展示完整分布，但**不切换模式、也不投递原话**，输出里明确写"自动切换已关闭"并给出手动切换指引 |
| `routerThreshold` | `0.6` | `0`–`1` | **自动切换阈值**（语义不变）：Top-1 概率 ≥ 阈值才自动切换；低于阈值只展示分布。非法值（越界/非数/NaN）在 host 侧**回落 0.6**，不会让配置或指令崩溃 |

- **怎么改**：左侧栏 → **插件** → 点进 **dsh-switch-preset** 详情页 → 正文配置区改完点「保存」；
  保存即写 profile 条目的 volatile 字段 `routerSettings`（`settings.mutate`），**下一次 `/router-preset` 生效**（无需重启）。
- **存在哪里**：profile 条目 `switch-preset`（`cordis.patch.yml` 注册名）的配置 `config.routerSettings`，
  不是插件私有状态文件；卡片经插件自有 REST（`/api/dsh-switch-preset/settings`、`/settings/watch`）读写。
- **为什么详情页才显示**：上游 `ui-plugin-manager` 只在该包名注册过 keyed 槽 `plugins.bundle.config`
  （key = **包名** `dsh-switch-preset`）时才渲染配置区（`configured = ledger.bundles.has(pkg.name)`），
  故卡片注册用包名做 key，构建门禁也断言这一点。
- **失败可见**：设置服务不可用/保存报错时卡片显示明确文案（含服务端原因），不静默失败；
  阈值越界在客户端与 host 两侧都会拦（400 + 文案）。

### `/router-preset` 概率路由怎么工作（v0.5.0，v0.5.1 参数化）

```
/router-preset 这个插件打包后加载报错，帮我改代码
        ↓ ① 概率判定（本地确定性打分：关键词/意图加权 → 归一化为概率分布）
   工程模式 98.4% ★ ｜ 学习/办公/研究/排障/视频 各 0.3%
        ↓ ② 98.4% ≥ 阈值 60% → 自动切换（复用 /switch-preset 的切换语义）
        ↓ ③ 客户端把原话作为「工程模式」下的普通用户消息继续发出
```

- **不给答案时就给概率**：任何输入都会输出 6 个模式的完整概率分布（含命中词，可解释），
  取概率最高者作为切换目标。
- **低置信度不乱切，但判定详情必然可见**（v0.6.0）：最高概率 < 阈值（默认 0.6）时**不切换模式**，
  但把「判定详情 + 你的原话」一起投递到**当前模式**继续——页面必然渲染（修复新会话下纯文本命令
  结果不可见的上游 blank 门控问题），原话也在当前模式下被正常处理；仍提示
  `如确认切到 X：/switch-preset <id>`。
- **可整体关掉自动切换**（v0.5.1）：插件页配置区把「自动切换」关掉后，`/router-preset` 只判定与展示，
  **不切换、不投递**；想要更保守/更激进的判定，直接把「判定阈值」调到 0.8 或 0.4 即可。
- **切换失败不投递**：若切换报错，原话**不会**发出（避免在原模式下误跑），并明确告知原因。
- **投递在 Host 侧完成**（上游契约决定，2026-09-28 实测结论）：DSH 命令 handler 本身
  "不把内容发给模型"（只返回文本），`CommandResult` 也只有 `{kind,text,sourceEventSeq}`；
  而客户端**没有公开钩子**能观察"用户键入的命令"的结果（`conversation.composer.bar` 的
  `hooks.notices` 是 package-private 且插槽为 single 已被占用）。因此投递由 Host 侧
  core 服务 `sessionController.prompt({mode:'queue'})` 完成——**插件不调用任何模型 API**，
  只是把一条用户输入放进会话，由 DSH 自己的 agent 循环在新模式下处理。
  会话日志里它就是一条 `role:"user"` 的普通用户消息。
- **概率引擎可插拔**：`ModeScorer` 接口是唯一打分入口；当前实现 `local-keyword-v1`
  （零依赖、离线可用、可单测），将来接入 JEV 类模型只需提供同一接口的新实现，
  命令层与客户端**零改动**（见 `src/host/router.ts` 的接口注释）。

## 切换语义（v0.2.0：留在当前会话）

| 当前会话状态 | `/switch-preset <id>` 行为 | 结果 |
|---|---|---|
| **尚未开始对话**（空会话） | `ctx.agentPresets.select(agent, id)`（框架正规路径） | ✅ **就地换模式**，留在当前会话，立即生效 |
| **已开始对话** | `ctx.agentPresets.recompose(agent.ctx, id)` **强制重装配** + 写入 `agent-preset/selected` 事件 | ✅ **当前会话（含既有历史）原地切换**，立即生效；附提示：历史中旧模式独有工具调用可能无法解析 |
| 目标即当前模式 | 幂等处理 | ✅ 提示"已经是该模式，无需切换" |
| 目标不存在 / 损坏 / id 格式非法 | 零副作用 | ❌ 明确报错，并提示用 `/list-preset` 查看 |

> 框架说明：DSH 默认禁止已开始会话换 preset（`select` 会抛 `agent-preset/locked`）。
> 本插件对已开始会话走 `recompose` 强制重装配（跳过锁定检查），这是用户显式要求的
> 行为；若当前 DSH 版本未提供 `recompose`，则自动降级为「写默认模式」（0.2.x 行为）。

## 复用的 DSH 框架能力（不重造轮子）

- `ctx.commands`：两条斜杠指令的注册/分发/执行记录（不产生模型消息）
- `ctx.agentPresets.remoteExportList()`：模式清单 + 中文名/描述 + 默认标注 + 健康度 + 模式选择开关（roster 单一真源）
- `ctx.agentPresets.select()`：空会话就地换模式（复用框架自带的锁定判定）
- `ctx.settings.mutate('agent-preset-registry', [{ op: 'set', path: ['selectedDefault'], value: id }], revision)`：写官方"默认模式"（已开始会话的降级路径）
- `ctx.settings.mutate(entryId, [{ op: 'set', path: ['routerSettings', <key>], value }], revision)`（v0.5.1）：写本插件自己的路由参数，**命名空间 = profile 条目 id**（非包名）
- 插件行 `Config` 的 **volatile 字段**（v0.5.1）：`config.routerSettings.get()` 读当前值；`ctx.on('loader/volatile-update', paths)` 监听热更新
- `ctx.webServer.register({ kind: 'exact', path, handler })`（v0.5.1）：配置卡片的 REST 数据面
- session 投影 `agentPreset`：识别当前会话模式（列表标注用）
- 客户端 `remote.agentPresets.list` / `remote.commands.execute`：选择器数据源与命令复用通道
- 客户端槽 `plugins.bundle.config`（v0.5.1，key = 包名）：插件详情页配置区；`conversation.input.right`：模式选择器

## 环境支持矩阵（2026-09-26 双环境约定，总约定见 [`../docs/ENV-COMPATIBILITY.md`](../docs/ENV-COMPATIBILITY.md)）

| 环境 | ubuntu-4090 | windows-lite |
|---|---|---|
| `dsh-switch-preset` | 全量 | 全量 |

纯 TypeScript Host + Client 插件：运行时只依赖 `node:*` 与 DSH 服务（`commands` / `agentPresets` /
`settings` / `slots` / `remote.*`），无本地模型、无数据库、无 OS 分支（`process.platform` /
主机名 / 绝对 unix 路径一概不用），持久状态全部落在 DSH 自身（session 事件、settings），
因此两个环境行为一致（依据见 `../docs/ENV-COMPATIBILITY.md` §3）。

## 安装（tgz，2026-09-23 起唯一方式）

```bash
cd dsh-plugins/dsh-switch-preset
pnpm check          # 构建门禁 + 双端 typecheck + 冒烟 + 逻辑单测（自持可跑）
npm pack            # 产出 dsh-switch-preset-<version>.tgz
dsh-dev plugin --profile web add /abs/path/dsh-switch-preset-<version>.tgz

# 装到 3082 后（征得同意再重启）
systemctl --user restart dsh-dev-web
```

**安装纪律**：本插件只用 tgz 安装，不用源码 link（link 会让"磁盘新/进程旧"、依赖借外部目录，
难以察觉）；**每次重打包必须升版本号**——同版本重打包时 pnpm 按 lockfile `integrity` 判定
"已最新"而不会重新解压。

**环境注意**：本机根挂载当前为只读（`errors=remount-ro`）时 `~/.dsh-dev` 不可写，安装会 EROFS；
pnpm store 落在只读区时用 `PNPM_HOME=<可写目录>` 绕行。详见 `docs/TROUBLESHOOTING.md` §2。

## 开发

```bash
npm run check          # 构建门禁 + 双端 typecheck + 冒烟 + switch 逻辑单测
npm run build          # 仅构建（含产物门禁）
npm run typecheck      # 双 tsconfig --noEmit
npm test               # 冒烟 + switch 逻辑单测
```

结构：`src/index.ts`（Host 入口 + `Config` 再导出）· `src/host/`（switch/router/route 纯逻辑 + 命令注册 + `settings.ts` 设置面与 REST 路由 + 类型）· `src/client/`（模式选择器 + `settings-card.ts` 配置卡片 + `settings-api.ts` 数据面）· `src/shared/`（跨端契约与常量单一真源：`contracts.ts` / `router-settings.ts` / `threshold.ts`）。

## 已知限制

- **配置区只在插件详情页显示**：上游只在包名注册过 `plugins.bundle.config` 时渲染该区；若把插件装在非 web 组合
  （没有 `webServer`/`settings` 服务），卡片会降级为只读提示，`/router-preset` 仍按默认值（开启、0.6）工作。
- **阈值非法值回落而不是报错**：配置文件被手改成越界值时，运行时**回落 0.6**
  （loader 侧同时打 warning，`vendor/loader` 的 `_commitVolatile` 语义），以保证不因配置损坏而崩；
  该非法值仍留在用户层，故**配置卡片会如实显示这个越界值**（不粉饰），而 `/router-preset` 的阈值回显是 60.0%
  （以回落值为准）——保存一个合法值即覆盖。从 UI 保存的越界值会被 host 侧直接拒绝（400 + 明确文案）。

- **已开始会话换 preset 会更换工具集**：历史中旧模式独有的工具调用可能无法在新模式下解析（DSH 默认禁止换 preset 的原因）；本插件在用户显式要求下走 `recompose` 强制切换，成功文案附此提示。
- 写默认模式需要 `settings` 服务；该服务缺失时指令会明确报错而非静默成功。部署关闭「模式选择」开关（`agent-preset-registry.modeSelectionEnabled=false`）时写默认模式不生效，指令同样明确报错并说明恢复办法（新建会话或先在设置里打开开关）。
- 模式的中文名/描述来自各 preset 的 `preset.yml`（`name`/`description`）；未填写则只显示 id。
- 指令仅在交互式 Web 界面可用（`commands` 服务在无 UI 组合中不存在）。

更多决策与踩坑：`docs/`（`specs/001-switch-preset/` 为规格三件套，`TROUBLESHOOTING.md` 含 DSH API 版本基线）。
<!-- deepseek-shared-layout -->

## Windows / Ubuntu 共用目录

本项目遵循 [DeepSeek 共用目录约定](../dsh-agent-presets/docs/DIRECTORY-LAYOUT.md)。管理根统一写作 `<DEEPSEEK_ROOT>`（`.../deepseek/`），历史部署记录不能视为当前机器状态；Bash/systemd 命令只适用于对应环境，配置文件中的路径须在本机解析。
