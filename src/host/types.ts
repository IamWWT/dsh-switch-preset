/**
 * host/types.ts — cordis Context 的服务类型扩展（仅声明本插件实际消费的属性）
 *
 * cordis 的 Context 是代理类，不带有 dsh 服务属性类型；插件侧以最小接口交叉
 * 扩展（形状对齐 DSH 运行时，基线见 docs/TROUBLESHOOTING.md）。type-only 依赖，
 * 不参与 client 打包。
 *
 * v2.0（2026-09-23，0.1.7 对齐）：
 *   - 命令注册面按 0.1.7 `CommandDefinition`/`CommandInvocation` 声明
 *     （invocation 至少含 `agent` 与 `rawInput`）。
 *   - settings 面从旧的 `update(namespace, patch)`（命名空间文档模型，已移除）
 *     改为 0.1.7 `SettingsForms`：`describe()` + `mutate(entryId, ops, revision)`。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {
  AgentLike,
  AgentPresetsLike,
  SwitchResult,
} from '../shared/contracts.ts'

/** 斜杠命令注册服务最小形状（对齐 0.1.7 ctx.commands）。 */
export interface CommandsLike {
  register(definition: {
    name: string
    description: string
    input?: { readonly hint?: string }
    handler: (invocation: { agent: AgentLike; rawInput: string }) =>
      SwitchResult | Promise<SwitchResult>
  }): unknown
}

/** 一条 profile 条目的设置表单视图（对齐 0.1.7 SettingsDescriptor）。 */
export interface SettingsDescriptorLike {
  readonly ns: string
  readonly value?: unknown
  readonly revision?: number
}

/** 0.1.7 设置服务最小形状（SettingsForms：只声明本插件用到的面）。 */
export interface SettingsLike {
  describe(): SettingsDescriptorLike[]
  mutate(ns: string, ops: readonly { op: 'set'; path: string[]; value: unknown }[], expectedRevision?: number): Promise<void>
}

/** 本插件使用到的 host 服务视图（可选服务经 ctx.get 惰性取用）。 */
export type PluginContext = Context & {
  readonly commands: CommandsLike
  readonly agentPresets: AgentPresetsLike
  /** Context 实例方法：取未在 inject 中声明的可选服务（缺失返回 undefined）。 */
  readonly get?: <K extends string>(key: K) => unknown
}
