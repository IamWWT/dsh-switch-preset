/**
 * host/command.ts — /switch-preset 与 /list-preset 的命令注册（Host 侧唯一入口）
 *
 * 职责：把 cordis ctx 的真实服务组装成 SwitchDeps（形状见 shared/contracts.ts），
 * 注册两条命令并将 handler 委托给 switch.ts 纯逻辑。
 * 升级 deepseek-harness 后若服务形状变化，只需改本文件的组装层（单点适配，
 * 基线记录见 docs/TROUBLESHOOTING.md）。
 *
 * v0.2.1 修复（2026-09-18 实测）：settings 服务**只能经 `ctx.inject(['settings'], cb)`
 * 二次注入获取**（cordis 的 `ctx.get('settings')` 取不到未声明服务，实测返回 undefined
 * → 已开始会话降级路径报"设置服务不可用"）。因此本模块不再自行 get settings，
 * 而是由 index.ts 在 apply 里注入 settings 实例，命令**每次执行时**惰性解析
 * （settings 可能晚于 apply 就绪）。
 */
import {
  AGENT_PRESETS_NS,
  COMMAND_NAME,
  KEY_DEFAULT_PRESET,
  LIST_COMMAND_NAME,
  type SwitchDeps,
} from '../shared/contracts.ts'
import { listPresets, switchPreset } from './switch.ts'
import type { PluginContext } from './types.ts'

/** settings provider 的最小写入形状（对齐 ctx.settings.update）。 */
export interface SettingsWriteLike {
  update(namespace: string, patch: object): Promise<void>
}

/** 惰性取 settings 写入能力（index.ts 经 ctx.inject(['settings']) 提供）。 */
export type GetSettings = () => SettingsWriteLike | undefined

/** sessionProjections 最小形状（core seam，可选）。 */
interface ProjectionsLike {
  stateOf(session: unknown, key: string): unknown
}

/**
 * 从 ctx 组装 SwitchDeps。
 * @param getSettings - 惰性解析 settings 写入服务（命令执行时调用，保证拿到最新实例）。
 */
export function buildSwitchDeps(ctx: PluginContext, getSettings: GetSettings): SwitchDeps {
  const projections = ctx.get?.('sessionProjections') as ProjectionsLike | undefined
  return {
    agentPresets: ctx.agentPresets,
    // 写「默认模式」复用官方 agent-presets 设置命名空间；每次执行时解析 settings，
    // 服务缺失时抛出明确错误（switch.ts 已含降级文案）
    setDefaultPreset: async (presetId: string) => {
      const settings = getSettings()
      if (!settings) throw new Error('设置服务不可用')
      await settings.update(AGENT_PRESETS_NS, { [KEY_DEFAULT_PRESET]: presetId })
    },
    currentPreset: async (agent) => {
      if (!projections) return undefined
      try {
        const value = projections.stateOf(agent.session, 'agentPreset')
        return typeof value === 'string' ? value : undefined
      } catch {
        return undefined
      }
    },
  }
}

/** 注册两条命令（ctx.commands.register 返回 disposer，由 cordis 生命周期回收）。 */
export function registerSwitchPresetCommands(ctx: PluginContext, getSettings: GetSettings): void {
  ctx.commands.register({
    name: COMMAND_NAME,
    description: '切换当前会话模式（Agent preset）：空会话就地切换，已开始的会话改为设定默认模式',
    input: { hint: '<preset-id>（可留空查看清单）' },
    // 每次执行时重建 deps：settings / 投影等可能晚于 apply 就绪，惰性取最新
    handler: async ({ agent, rawInput }) => switchPreset(agent, rawInput, buildSwitchDeps(ctx, getSettings)),
  })

  ctx.commands.register({
    name: LIST_COMMAND_NAME,
    description: '列出全部可用模式（preset id + 中文名 + 中文描述）及当前/默认模式',
    handler: async ({ agent }) => listPresets(agent, buildSwitchDeps(ctx, getSettings)),
  })

  ctx.logger.info(`[dsh-switch-preset] commands registered: /${COMMAND_NAME} + /${LIST_COMMAND_NAME}`)
}