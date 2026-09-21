/**
 * shared/contracts.ts — dsh-switch-preset 的跨端最小契约（Host/Client 共享）
 *
 * 设计取舍（plan.md §2）：DSH 0.1.x 服务包在 npm registry 全为预发布版本，
 * 为避免 semver 锁死与类型爆炸，这里只声明本插件实际消费的服务形状（与 DSH
 * 运行时保持一致的最小接口）。形状对齐基线见 docs/TROUBLESHOOTING.md
 * （升级 deepseek-harness 后按该基线核对）。
 *
 * v1.1（2026-09-17 用户反馈）：切换语义改为「留在当前会话」——
 *   空会话就地 select 换 preset；已开始会话（框架锁死）写默认模式。
 * 因此不再有 sessionId 跳转契约与 inheritHistory 设置键。
 */

/** 模式（Agent preset）roster 行的最小形状（对齐 ctx.agentPresets.list() 结果）。 */
export interface PresetRow {
  readonly id: string
  /** roster 的 display name（本机 preset.yml 为中文名，如「工程模式」）。 */
  readonly displayName?: string
  /** roster 的 description（本机 preset.yml 为中文描述）。 */
  readonly description?: string
  /** 该预设是否损坏（composition 无法加载）。 */
  readonly broken?: boolean
  /** 是否为当前部署/用户选定的默认模式。 */
  readonly isDefault?: boolean
}

/** 当前会话 agent 的最小形状（commands handler 传入）。 */
export interface AgentLike {
  /** agent 的 scope context（recompose 需要，与 ctx.agentPresets.recompose 配套）。 */
  readonly ctx?: unknown
  readonly session: {
    readonly id: string
    /** 持久化一条 session 事件（agent-presets 用 'agent-preset/selected' 记录换模式）。 */
    append?: (type: string, data: unknown) => void | Promise<void>
  }
}

/** Agent presets 服务最小形状（对齐 ctx.agentPresets）。 */
export interface AgentPresetsLike {
  /** roster：shipped + 配置根 + 用户根的全部模式（含 broken / isDefault）。 */
  list(): Promise<readonly PresetRow[]>
  /**
   * 就地把某个 agent 换成目标 preset（仅空会话可用；已开始的会话抛
   * `agent-preset/locked`）。返回实际装配的 preset id。
   */
  select(agent: AgentLike, presetId: string): Promise<string>
  /**
   * 不经过空会话锁定检查，直接把 agent 重新装配到目标 preset（`select` 内部
   * 通过锁定检查后调它；本插件在用户显式要求下对已开始会话调用）。
   * 返回装配后的 preset（含 id/displayName 等）。
   */
  recompose?(agentCtx: unknown, presetId: string): Promise<PresetRow>
}

/** 切换依赖集合（实现层注入真实服务，纯逻辑层只认接口）。 */
export interface SwitchDeps {
  readonly agentPresets: AgentPresetsLike
  /**
   * 写入「默认模式」（agent-presets 设置命名空间的 default），影响之后新建的会话。
   * 设置服务不可用时为 undefined（调用方给出明确错误而非静默成功）。
   */
  readonly setDefaultPreset?: (presetId: string) => Promise<void>
  /** 读取当前会话已生效的 agentPreset（列表展示用）；读不到返回 undefined。 */
  readonly currentPreset?: (agent: AgentLike) => Promise<string | undefined>
}

/** 命令统一结果（与 ctx.commands 的 handler 返回形状一致）。 */
export type SwitchResult =
  | { readonly kind: 'success'; readonly text: string }
  | { readonly kind: 'error'; readonly text: string }

/** 切换指令名（Host 注册名 / Client 构造命令行 共用）。 */
export const COMMAND_NAME = 'switch-preset'

/** 列表指令名：查看 /switch-preset 应填写的 preset id 及中文描述。 */
export const LIST_COMMAND_NAME = 'list-preset'

/** agent-presets 设置命名空间与「默认模式」键（写默认模式复用官方命名空间）。 */
export const AGENT_PRESETS_NS = 'agent-presets'
export const KEY_DEFAULT_PRESET = 'default'

/** preset id 合法形状（对齐 agent-presets 约定）。 */
export const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/