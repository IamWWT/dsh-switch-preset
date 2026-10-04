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
import { randomUUID } from 'node:crypto'
import {
  AGENT_PRESET_REGISTRY_ID,
  COMMAND_NAME,
  KEY_SELECTED_DEFAULT,
  LIST_COMMAND_NAME,
  MEMORY_ROUTER_COMMAND_NAME,
  ROUTER_COMMAND_NAME,
  type SwitchDeps,
} from '../shared/contracts.ts'
import { listPresets, switchPreset } from './switch.ts'
import { routePreset } from './route.ts'
import { defaultScorer } from './router.ts'
import { loadMemoryContext } from './memory.ts'
import type { PluginContext, SettingsDescriptorLike, SettingsLike } from './types.ts'
import type { RouterSettings } from '../shared/router-settings.ts'
import { DEFAULT_ROUTER_SETTINGS } from '../shared/router-settings.ts'

/** 惰性取设置在服务（index.ts 经 ctx.inject(['settings']) 提供，可能晚于 apply 就绪）。 */
export type GetSettings = () => SettingsLike | undefined

/** sessionProjections 最小形状（core seam，可选）。 */
interface ProjectionsLike {
  stateOf(session: unknown, key: string): unknown
}

/**
 * sessionController 最小形状（core API 服务，Host 侧唯一"把内容交给会话"的公开通道）。
 *
 * v0.5.0：`/router-preset` 的第③步（投递用户原话为该会话的后续输入）走它。
 * 与 dsh-report-studio 的生成通道同一范式——**插件不调用任何模型 API**，
 * 只是把一条用户输入放进会话，由 DSH 自己的 agent 循环处理。
 */
export interface SessionControllerLike {
  prompt(
    request: {
      requestId: string
      sessionId: string
      mode: 'queue' | 'steer'
      content: readonly { type: 'text'; text: string }[]
    },
    signal?: AbortSignal,
  ): Promise<{ accepted: boolean }>
}

/** 惰性解析 sessionController（可能晚于 apply 就绪；缺失即如实报告不可用）。 */
export type GetSessionController = () => SessionControllerLike | undefined

/**
 * 惰性解析路由参数（v0.5.1）。
 *
 * 由 `index.ts` 经 `createRouterSettingsFacade()` 提供；读的是插件行 volatile 字段
 * `routerSettings`（loader 维护的当前值）。**返回值必须已归一化**（非法阈值回落 0.6）；
 * 命令层对缺失/异常再兜一层出厂默认，保证 `/router-preset` 在设置面不可用时仍按原语义工作。
 */
export type GetRouterSettings = () => RouterSettings

/**
 * 惰性解析 dsh-kb 知识库根目录配置（v0.6.0，/router-preset-memory 用）。
 *
 * 由 `index.ts` 把插件行配置原样传入（`config.kbRoot` 为 volatile 包装或普通字符串，
 * 与 daily-workbench 同字段名）。`loadMemoryContext` 内部做四层回退
 * （config → DASH_KB_HOME → 模块推导 → ~/dsh-kb），配置面缺失/异常**不阻塞命令**。
 */
export type GetKbRoot = () => { kbRoot?: unknown }

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
export function buildSwitchDeps(
  ctx: PluginContext,
  getSettings: GetSettings,
  getSessionController?: GetSessionController,
  getRouterSettings?: GetRouterSettings,
): SwitchDeps {
  const projections = ctx.get?.('sessionProjections') as ProjectionsLike | undefined
  // v0.5.1：路由参数每次执行时惰性读取（设置页改动即时生效）；缺失/异常回落出厂默认，
  // 归一化交给命令层（`routePreset` 内部的 normalizeRouterSettings）保证不会抛错。
  const routerSettings = (): RouterSettings => {
    try {
      return getRouterSettings?.() ?? { ...DEFAULT_ROUTER_SETTINGS }
    } catch {
      return { ...DEFAULT_ROUTER_SETTINGS }
    }
  }
  return {
    agentPresets: ctx.agentPresets,
    getRouterSettings: routerSettings,
    // v0.5.0：③ 投递原话（Host 侧，core 服务 sessionController.prompt，不调用模型 API）
    deliverUtterance: async (agent, utterance) => {
      const controller = getSessionController?.()
      if (!controller || typeof controller.prompt !== 'function') {
        return { ok: false, message: 'sessionController 服务不可用（当前 profile 可能未启用会话能力）' }
      }
      const sessionId = agent.session?.id
      if (!sessionId) return { ok: false, message: '会话 id 不可用' }
      const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(15000)
        : undefined
      const receipt = await controller.prompt(
        {
          requestId: randomUUID(),
          sessionId,
          // queue：作为该会话的**下一条用户输入**排队（等当前回合结束/切换生效后处理）
          mode: 'queue',
          content: [{ type: 'text', text: utterance }],
        },
        signal,
      )
      return receipt?.accepted === true
        ? { ok: true, message: '已作为该会话的后续输入投递（接下来由 agent 在该模式下处理）。' }
        : { ok: false, message: '会话未接受该输入（可能正在处理中或会话已关闭）' }
    },
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
export function registerSwitchPresetCommands(
  ctx: PluginContext,
  getSettings: GetSettings,
  getSessionController?: GetSessionController,
  getRouterSettings?: GetRouterSettings,
  getKbRoot?: GetKbRoot,
): void {
  ctx.commands.register({
    name: COMMAND_NAME,
    description: '切换当前会话模式（Agent preset）：空会话就地切换；已开始的会话按需强制重装配',
    input: { hint: '<preset-id>（可留空查看清单）' },
    // 每次执行时重建 deps：settings / 投影等可能晚于注册时点就绪，惰性取最新
    handler: async ({ agent, rawInput }) => switchPreset(agent, rawInput, buildSwitchDeps(ctx, getSettings, getSessionController, getRouterSettings)),
  })

  ctx.commands.register({
    name: LIST_COMMAND_NAME,
    description: '列出全部可用模式（preset id + 中文名 + 中文描述）及当前/默认模式',
    handler: async ({ agent }) => listPresets(agent, buildSwitchDeps(ctx, getSettings, getSessionController, getRouterSettings)),
  })

  // v0.5.0：概率路由（用户 2026-09-28 需求）——判定 → 切换 → 原话接力。
  // 切换语义复用 switchPreset（单一真源）；"接力发送"由客户端解析结果标记后走原生输入通道完成。
  // v0.5.1：第 5 参改为 RouteOptions（来自设置页的 enabled/threshold，两个参数都可配）。
  ctx.commands.register({
    name: ROUTER_COMMAND_NAME,
    description: '按概率判定该用哪个模式：达阈值自动切换，并把你的原话作为该模式下的输入继续',
    input: { hint: '<你的原话>（系统判定模式概率最高者）' },
    handler: async ({ agent, rawInput }) => {
      const deps = buildSwitchDeps(ctx, getSettings, getSessionController, getRouterSettings)
      return routePreset(agent, rawInput, deps, defaultScorer, deps.getRouterSettings?.() ?? { ...DEFAULT_ROUTER_SETTINGS })
    },
  })

  // v0.6.0：记忆路由（用户 2026-10-05 需求，见 docs/REQUIREMENTS.md）——
  // 与 /router-preset 相同的判定→切换，但投递内容 = dsh-kb 渐进加载的记忆上下文 + 原话，
  // 让切换后模式下的 agent 开局就带相关记忆（L1 个人 → L2 项目 → L3 会话）。
  // 记忆加载失败降级不阻塞（ok=false 时仍按原话投递，命令层回显说明）。
  ctx.commands.register({
    name: MEMORY_ROUTER_COMMAND_NAME,
    description: '与 /router-preset 相同判定→切换，但投递时附带 dsh-kb 渐进加载的记忆（个人→项目→会话）',
    input: { hint: '<你的原话>（判定模式并带记忆切换）' },
    handler: async ({ agent, rawInput }) => {
      const deps = buildSwitchDeps(ctx, getSettings, getSessionController, getRouterSettings)
      const cfg = getKbRoot?.() ?? {}
      return routePreset(
        agent,
        rawInput,
        deps,
        defaultScorer,
        deps.getRouterSettings?.() ?? { ...DEFAULT_ROUTER_SETTINGS },
        (utterance, topId) => loadMemoryContext(cfg, utterance),
      )
    },
  })

  ctx.logger.info(
    `[dsh-switch-preset] commands registered: /${COMMAND_NAME} + /${LIST_COMMAND_NAME} + /${ROUTER_COMMAND_NAME} + /${MEMORY_ROUTER_COMMAND_NAME}`,
  )
}
