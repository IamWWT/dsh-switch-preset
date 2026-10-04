/**
 * shared/contracts.ts — dsh-switch-preset 的跨端最小契约（Host/Client 共享）
 *
 * v2.0（2026-09-23，harness 0.1.7 原地对齐，无兼容垫片）：
 *   1. **roster 字段改名**：0.1.7 的 `agentPresets.list()` 返回
 *      `{ id, name?, description?, order?, broken? }`（见
 *      `packages/preset/agent-preset-registry/src/preset.ts`），
 *      旧的 `displayName` 已不存在——继续读它会让所有模式都退化成裸 id。
 *   2. **「默认模式」的写入目标变了**：0.1.7 没有 `agent-presets` 这个设置条目；
 *      默认模式是内置条目 **`agent-preset-registry`** 的 volatile 字段
 *      **`selectedDefault`**，经 `ctx.settings.mutate(entryId, [{op:'set',…}])` 写。
 *   3. **模式选择开关**：注册表的 `modeSelectionEnabled`
 *      （volatile，默认 true）决定"新会话是否暴露模式选择、保存的默认值是否生效"。
 *      其策略是 `enabled ? selectedDefault ?? default : default`，
 *      因此关掉开关时写 `selectedDefault` **不会生效**，插件必须显式告知而不是假装成功。
 *   4. `remoteExportList()`（`@Remote('list')` 的宿主实现）一次返回
 *      `{ presets, modeSelectionEnabled }`——清单与策略的单一真源，本插件直接用它。
 *
 * 设计取舍：DSH 服务包在 npm 全为预发布版本，为避免 semver 锁死与类型爆炸，
 * 这里只声明本插件实际消费的服务形状（最小接口，契约先行，铁律 #3）。
 */
import type { RouterSettings } from './router-settings.ts'

/** 模式（Agent preset）roster 行的最小形状（对齐 0.1.7 ctx.agentPresets.list()）。 */
export interface PresetRow {
  readonly id: string
  /** 模式展示名（preset.yml 的 `name`，如「工程模式」）；缺省时回退到 id。 */
  readonly name?: string
  /** 模式用途的一句话描述（preset.yml 的 `description`）。 */
  readonly description?: string
  /** 该预设是否损坏（composition 无法加载），损坏时不可选。 */
  readonly broken?: string
  /** 是否为当前生效的默认模式（仅 remoteExportList 的行走带此标记）。 */
  readonly isDefault?: boolean
}

/** roster + 策略（`ctx.agentPresets.remoteExportList()` 的返回形状）。 */
export interface PresetRoster {
  readonly presets: readonly PresetRow[]
  /** 新会话是否暴露模式选择、保存的默认值是否生效。 */
  readonly modeSelectionEnabled: boolean
}

/** 当前会话 agent 的最小形状（commands handler 传入，0.1.7 CommandInvocation.agent）。 */
export interface AgentLike {
  /** agent 的 scope context（recompose 需要，与 ctx.agentPresets.recompose 配套）。 */
  readonly ctx?: unknown
  readonly session: {
    readonly id: string
    /** 持久化一条 session 事件（换模式后写 'agent-preset/selected' 保持投影一致）。 */
    append?: (type: string, data: unknown) => void | Promise<void>
  }
}

/** Agent presets 服务最小形状（对齐 0.1.7 ctx.agentPresets）。 */
export interface AgentPresetsLike {
  /** 清单 + 策略的单一真源（含 isDefault 与 modeSelectionEnabled）。 */
  remoteExportList(): Promise<PresetRoster>
  /**
   * 就地把某个 agent 换成目标 preset（仅空会话可用；已开始的会话抛
   * `agent-preset/locked`）。返回实际装配的 preset id。
   */
  select(agent: AgentLike, presetId: string): Promise<string>
  /**
   * 不经过空会话锁定检查，直接把 agent 重新装配到目标 preset（`select` 内部
   * 通过锁定检查后调它；本插件在用户显式要求下对已开始会话调用）。
   */
  recompose?(agentCtx: unknown, presetId: string): Promise<PresetRow>
}

/** 原话投递结果（把用户原话作为切换后模式下的后续输入交给 agent）。 */
export interface DeliveryOutcome {
  readonly ok: boolean
  /** 面向用户的说明（成功/失败原因），由命令回显拼接展示。 */
  readonly message: string
}

/** 切换依赖集合（实现层注入真实服务，纯逻辑层只认接口）。 */
export interface SwitchDeps {
  readonly agentPresets: AgentPresetsLike
  /**
   * 写「默认模式」= 内置条目 `agent-preset-registry` 的 `selectedDefault`。
   * 设置服务不可用时为 undefined（调用方给出明确错误而非静默成功）。
   */
  readonly writeDefaultPreset?: (presetId: string) => Promise<void>
  /** 读取当前会话已生效的 agentPreset（列表展示用）；读不到返回 undefined。 */
  readonly currentPreset?: (agent: AgentLike) => Promise<string | undefined>
  /**
   * v0.5.0：把用户原话投递为该 agent 会话的**后续输入**（`/router-preset` 的第③步）。
   *
   * 为什么在 Host 侧投递（2026-09-28 实测结论，取代原「客户端接力」方案）：
   * 上游命令契约明确 handler "不把命令发给模型"
   * （`packages/interaction/commands/src/index.ts`），`CommandResult` 也只有
   * `{kind,text,sourceEventSeq}`；而客户端**没有公开钩子**能观察"用户键入的命令"的执行结果
   * （`conversation.composer.bar` 的 `hooks.notices` 标注为 package-private 且插槽为 single），
   * 因此"客户端解析结果再补发"只能覆盖插件自己发起的调用，覆盖不了用户直接键入
   * `/router-preset xxx` 的主路径。故投递在 Host 侧完成（core 服务 sessionController.prompt，
   * 与 dsh-report-studio 的生成通道同一范式，不调用任何模型 API）。
   * 不可用时为 undefined → 调用方必须如实告知"未投递"，不得假报成功。
   */
  readonly deliverUtterance?: (agent: AgentLike, utterance: string) => Promise<DeliveryOutcome>
  /**
   * v0.5.1：读 `/router-preset` 的路由参数（插件页配置区 volatile 字段 `routerSettings`）。
   *
   * 每次命令执行时调用（惰性），保证拿到最新值；**未提供或读取异常时**命令层按出厂默认
   * （enabled=true、threshold=DEFAULT_ROUTE_THRESHOLD）工作——绝不因为设置面缺失就让命令失效。
   * 返回值由 `shared/router-settings.ts` 归一化（非法阈值回落 0.6，不抛错）。
   */
  readonly getRouterSettings?: () => RouterSettings
}

/** 命令统一结果（对齐 0.1.7 CommandResult：success 可带 text，error 必须带 text）。 */
export type SwitchResult =
  | { readonly kind: 'success'; readonly text: string }
  | { readonly kind: 'error'; readonly text: string }

/** 切换指令名（Host 注册名 / Client 构造命令行 共用）。 */
export const COMMAND_NAME = 'switch-preset'

/** 列表指令名：查看 /switch-preset 应填写的 preset id 及中文描述。 */
export const LIST_COMMAND_NAME = 'list-preset'

/** 未达阈值时给出「手动切换」指引的指令名（首页脚本由此区分两态）。 */
export const ROUTER_COMMAND_NAME = 'router-preset'

/**
 * 记忆路由指令名（v0.6.0，2026-10-05，用户记忆路由指导文件第 2 步）：
 * `/router-preset-memory <你的原话>` = 与 `/router-preset` 相同的概率判定→切换，
 * 但投递内容 = 「dsh-kb 渐进加载的记忆上下文 + 原话」，让切换后模式下的 agent
 * 开局就带相关记忆（L1 个人记忆 → L2 项目记忆 → L3 会话记忆）。
 */
export const MEMORY_ROUTER_COMMAND_NAME = 'router-preset-memory'

/** 渐进式记忆加载结果（host/memory.ts 的对外形状，命令层回显用）。 */
export interface MemoryContextResult {
  /** 是否成功解析到可用知识库并完成至少 L1 加载。 */
  readonly ok: boolean
  /** 面向用户的说明（加载了哪些层/失败原因），用于命令回显。 */
  readonly summary: string
  /** 投递给会话的记忆上下文文本（拼上原话后作为该会话的后续输入）。 */
  readonly context: string
}

/**
 * 记忆增强回调（v0.6.0，routePreset 可选第 6 参）：
 * 在投递前把「原话」加工为「记忆上下文 + 原话」。不传 = 行为与 v0.5.x 完全一致；
 * 传入 = `/router-preset-memory` 的投递内容替换。由命令层注入（memory.ts 的加载逻辑）。
 */
export type RouteEnrich = (utterance: string, topId: string) => Promise<MemoryContextResult>

/**
 * 内置 preset 注册表条目 id（0.1.7 从 `@deepseek-ai/dsh-web-app` 的 patch 层挂载）。
 * 默认模式写入目标 = 该条目 Config 的 `selectedDefault`。
 */
export const AGENT_PRESET_REGISTRY_ID = 'agent-preset-registry'

/** `agent-preset-registry` 的 volatile 字段名：用户选定的默认模式。 */
export const KEY_SELECTED_DEFAULT = 'selectedDefault'

/** preset id 合法形状（对齐 agent-presets 约定）。 */
export const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
