# dsh-switch-preset

DSH 会话模式切换插件：用斜杠指令 `/switch-preset` **在当前会话内**切换 Agent preset（DSH 的"会话模式"），并用 `/list-preset` 查看可填写的模式 id 与中文描述。

> 版本: 0.4.0 | 语言: TypeScript（Host + Client 双端）| 目标实例: Web GUI（3082 dev web / 临时实例）
> v0.4.0（2026-09-23）：**harness 0.1.7 原地对齐**（roster 字段/策略对象、默认模式写入目标改为
> `agent-preset-registry.selectedDefault`、尊重 `modeSelectionEnabled`、命令改二级注入）；
> v0.3.0（2026-09-18）：对已开始会话支持 **recompose 强制切换**（含历史原地换模式）。语义演进见 `CHANGELOG.md` 与 `docs/REQUIREMENTS.md`。

## 功能一览

| 指令 / 入口 | 作用 |
|---|---|
| `/list-preset` | 列出全部可用模式：**中文名（preset id）** + **中文描述**，并标注「当前会话」「默认」与损坏项；同时给出用法提示 |
| `/switch-preset`（无参） | 等同 `/list-preset` |
| `/switch-preset <id>` | 切换当前会话模式（语义见下表），**留在当前会话** |
| id 从哪来 | 直接复制 `/list-preset` 里括号中的 id（如 `engineering`、`research`） |
| composer 工具行「🔄」按钮 | 弹出模式列表（中文名 + 描述 + 默认标注），点选即执行 `/switch-preset <id>` |

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
- `ctx.agentPresets.list()`：模式清单 + 中文名/描述 + 默认标注 + 健康度（roster 单一真源）
- `ctx.agentPresets.select()`：空会话就地换模式（复用框架自带的锁定判定）
- `ctx.settings.update('agent-presets', { default })`：写官方"默认模式"（已开始会话的降级路径）
- session 投影 `agentPreset`：识别当前会话模式（列表标注用）
- 客户端 `remote.agentPresets.list` / `remote.commands.execute`：选择器数据源与命令复用通道

## 安装（开发期，源码 link）

```bash
npm run check     # 构建门禁 + 双端 typecheck + 冒烟 + 逻辑单测

# 一键安装到指定 DSH 实例（必须显式给 TARGET_DSH_HOME，防误装生产）
TARGET_DSH_HOME=<目标 DSH_HOME> HARNESS_DIR=<harness 目录> npm run install:dev

# 装到 3082 后（征得同意再重启）
systemctl --user restart dsh-dev-web
```

**环境注意**：本机根挂载当前为只读（`errors=remount-ro`）时 `~/.dsh-dev` 不可写，安装会 EROFS；
pnpm store 落在只读区时用 `PNPM_HOME=<可写目录>` 绕行。详见 `docs/TROUBLESHOOTING.md` §2。

## 开发

```bash
npm run check          # 构建门禁 + 双端 typecheck + 冒烟 + switch 逻辑单测
npm run build          # 仅构建（含产物门禁）
npm run typecheck      # 双 tsconfig --noEmit
npm test               # 冒烟 + switch 逻辑单测
```

结构：`src/index.ts`（Host 入口）· `src/host/`（switch 纯逻辑 + 命令注册 + 类型）· `src/client/`（模式选择器）· `src/shared/contracts.ts`（跨端契约与常量单一真源）。

## 已知限制

- **已开始会话换 preset 会更换工具集**：历史中旧模式独有的工具调用可能无法在新模式下解析（DSH 默认禁止换 preset 的原因）；本插件在用户显式要求下走 `recompose` 强制切换，成功文案附此提示。
- 写默认模式需要 `settings` 服务；该服务缺失时指令会明确报错而非静默成功。
- 模式的中文名/描述来自各 preset 的 `preset.yml`（`name`/`description`）；未填写则只显示 id。
- 指令仅在交互式 Web 界面可用（`commands` 服务在无 UI 组合中不存在）。

更多决策与踩坑：`docs/`（`specs/001-switch-preset/` 为规格三件套，`TROUBLESHOOTING.md` 含 DSH API 版本基线）。
<!-- deepseek-shared-layout -->

## Windows / Ubuntu 共用目录

本项目遵循 [DeepSeek 共用目录约定](../dsh-agent-presets/docs/DIRECTORY-LAYOUT.md)。管理根统一写作 `<DEEPSEEK_ROOT>`（`.../deepseek/`），历史部署记录不能视为当前机器状态；Bash/systemd 命令只适用于对应环境，配置文件中的路径须在本机解析。

## 0.4.1 · 2026-09-25

使用 DSH 原生 Menu，向上展开、右缘对齐、portal 避免裁剪；恢复主题背景、键盘导航、焦点返回。 见 [修复规格](docs/specs/20260925-native-entry-ui/spec.md)。
