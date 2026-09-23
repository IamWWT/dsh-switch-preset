/**
 * host/command.ts — /switch-preset 与 /list-preset 的命令注册（Host 侧唯一入口）
 *
 * 职责：把 cordis ctx 的真实服务组装成 SwitchDeps（形状见 shared/contracts.ts），
 * 注册两条命令并将 handler 委托给 switch.ts 纯逻辑。升级 deepseek-harness 后若
 * 服务形状变化，只需改本文件的组装层（单点适配，基线见 docs/TROUBLESHOOTING.md）。
 *
 * v2.0 关键修复（2026-09-23 实测，harness 0.1.7）：
 *   1. **命令必须用二级注入注册**。0.1.7 的 `commands` 是作用域服务，把 `commands`
 *      写进插件级静态 `inject` 会让 Cordis 的 inject 门控**永不满足 → apply 根本不执行**
 *      （实测：模块已 import，apply 从未进入，命令不存在，`/list-preset` 毫无输出）。
 *      正确范式 = `ctx.inject(['commands', …], (cctx) => cctx.commands.register(...))`，
 *      工作区里能正常工作的 gateway-compaction 就是这个写法。
 *   2. **写默认模式的目标变了**：0.1.7 没有 `agent-presets` 设置条目（写它会抛
 *      `No configurable plugin entry`）。默认模式 = 内置条目 `agent-preset-registry`
 *      的 volatile 字段 `selectedDefault`，经 `settings.mutate(entryId, ops, revision)` 写。
 *      条目 id 不硬编码：从 `settings.describe()` 里找带 `selectedDefault` 的条目。
 */
import {
  AGENT_PRESET_REGISTRY_ID,
  COMMAND_NAME,
  KEY_SELECTED_DEFAULT,
  LIST_COMMAND_NAME,
  type SwitchDeps,
} from '../shared/contracts.ts'
import { listPresets, switchPreset } from './switch.ts'
import type { PluginContext, SettingsDescriptorLike, SettingsLike } from './types.ts'

/** 惰性取设置在服务（index.ts 经 ctx.inject(['settings']) 提供，可能晚于 apply 就绪）。 */
export type GetSettings = () => SettingsLike | undefined

/** sessionProjections 最小形状（core seam，可选）。 */
interface ProjectionsLike {
  stateOf(session: unknown, key: string): unknown
}

/** 判定一个设置条目是否是 preset 注册表（带 selectedDefault 字段的那条）。 */
function looksLikeRegistry(descriptor: SettingsDescriptorLike): boolean {
  const value = descriptor.value
  return typeof value === 'object' && value !== null && KEY_SELECTED_DEFAULT in (value as Record<string, unknown>)
}

/**
 * 解析「默认模式」的写入目标条目。
 * 先按运行时实况（describe 里有 selectedDefault 的条目）定位，找不到再回退到内置 id。
 * @returns 条目 id 与当前 revision（写入时回传做乐观锁）。
 */
function resolveRegistryTarget(
  settings: SettingsLike,
): { ns: string; revision: number | undefined } | undefined {
  try {
    const descriptors = settings.describe()
    const hit = descriptors.find(looksLikeRegistry)
    if (hit) return { ns: hit.ns, revision: hit.revision }
    const byId = descriptors.find(d => d.ns === AGENT_PRESET_REGISTRY_ID)
    if (byId) return { ns: byId.ns, revision: byId.revision }
  } catch {
    /* describe 失败：回落内置 id（写失败时由上层给出明确错误） */
  }
  return { ns: AGENT_PRESET_REGISTRY_ID, revision: undefined }
}

/**
 * 从 ctx 组装 SwitchDeps。
 * @param ctx - 命令注册所在的（子）上下文。
 * @param getSettings - 惰性解析 0.1.7 设置服务（命令执行时调用，保证拿到最新实例）。
 */
export function buildSwitchDeps(ctx: PluginContext, getSettings: GetSettings): SwitchDeps {
  const projections = ctx.get?.('sessionProjections') as ProjectionsLike | undefined
  return {
    agentPresets: ctx.agentPresets,
    writeDefaultPreset: async (presetId: string) => {
      const settings = getSettings()
      if (!settings) throw new Error('设置服务不可用')
      const target = resolveRegistryTarget(settings)
      if (!target) throw new Error(`未找到 preset 注册表条目（${AGENT_PRESET_REGISTRY_ID}）`)
      // 0.1.7 SettingsForms：按路径写入该条目的 volatile 字段
      await settings.mutate(
        target.ns,
        [{ op: 'set', path: [KEY_SELECTED_DEFAULT], value: presetId }],
        target.revision,
      )
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

/**
 * 注册两条命令（ctx.commands.register 返回 disposer，由 cordis 生命周期回收）。
 * 调用方必须传入**二级注入得到的孩子上下文**（见文件头 v2.0 说明）。
 */
export function registerSwitchPresetCommands(ctx: PluginContext, getSettings: GetSettings): void {
  ctx.commands.register({
    name: COMMAND_NAME,
    description: '切换当前会话模式（Agent preset）：空会话就地切换；已开始的会话按需强制重装配',
    input: { hint: '<preset-id>（可留空查看清单）' },
    // 每次执行时重建 deps：settings / 投影等可能晚于注册时点就绪，惰性取最新
    handler: async ({ agent, rawInput }) => switchPreset(agent, rawInput, buildSwitchDeps(ctx, getSettings)),
  })

  ctx.commands.register({
    name: LIST_COMMAND_NAME,
    description: '列出全部可用模式（preset id + 中文名 + 中文描述）及当前/默认模式',
    handler: async ({ agent }) => listPresets(agent, buildSwitchDeps(ctx, getSettings)),
  })

  ctx.logger.info(`[dsh-switch-preset] commands registered: /${COMMAND_NAME} + /${LIST_COMMAND_NAME}`)
}
