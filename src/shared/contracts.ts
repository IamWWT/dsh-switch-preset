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
}

/** 命令统一结果（对齐 0.1.7 CommandResult：success 可带 text，error 必须带 text）。 */
export type SwitchResult =
  | { readonly kind: 'success'; readonly text: string }
  | { readonly kind: 'error'; readonly text: string }

/** 切换指令名（Host 注册名 / Client 构造命令行 共用）。 */
export const COMMAND_NAME = 'switch-preset'

/** 列表指令名：查看 /switch-preset 应填写的 preset id 及中文描述。 */
export const LIST_COMMAND_NAME = 'list-preset'

/**
 * 内置 preset 注册表条目 id（0.1.7 从 `@deepseek-ai/dsh-web-app` 的 patch 层挂载）。
 * 默认模式写入目标 = 该条目 Config 的 `selectedDefault`。
 */
export const AGENT_PRESET_REGISTRY_ID = 'agent-preset-registry'

/** `agent-preset-registry` 的 volatile 字段名：用户选定的默认模式。 */
export const KEY_SELECTED_DEFAULT = 'selectedDefault'

/** preset id 合法形状（对齐 agent-presets 约定）。 */
export const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
