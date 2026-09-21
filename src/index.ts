/**
 * DSH 插件 Host 入口 — dsh-switch-preset
 *
 * 导出形态红线（PLUGIN-DEV-STANDARD §4.1）：一律具名导出，禁止 export default
 * （default export 会丢失 inject 声明）。版本四处同步（§2.4）。
 *
 * v1.1（2026-09-17）：切换语义 = 留在当前会话（空会话就地 select / 已开始会话写默认
 * 模式）；不再有 inheritHistory 设置项与 fork/create，故不再注册 settings 命名空间。
 * v0.2.1（2026-09-18）：修复「设置服务不可用」——settings 服务只能经
 * `ctx.inject(['settings'], cb)` 二次注入获取（直接 `ctx.get('settings')` 返回
 * undefined）；命令每次执行时惰性解析。
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerSwitchPresetCommands, type SettingsWriteLike } from './host/command.ts'
import type { PluginContext } from './host/types.ts'

/** 插件 id（bundle 注册名）。 */
export const name = 'dsh-switch-preset'

/**
 * 依赖服务声明：ctx.<服务> 取用前必须在此声明（Cordis Proxy 不做惰性兜底；
 * 未声明直接访问抛 "cannot get property ... without inject"）。
 * - commands    ：斜杠指令注册（interaction）
 * - agentPresets：roster 清单 + 就地对空会话换 preset（preset/agent-presets）
 * sessionProjections（读当前模式）经 ctx.get 惰性取用，缺失时降级提示；
 * settings（写默认模式）经 ctx.inject(['settings']) 二次注入（不能直接 ctx.get）。
 */
export const inject = ['commands', 'agentPresets']

/** 与 package.json version 同步（四处同步，改版本必同步本行）。 */
export const VERSION = '0.3.0'

/** 在 Web 交互式界面运行时注册 /switch-preset 与 /list-preset。 */
export function apply(ctx: Context): void {
  // settings 服务只能经二次注入获取；服务晚于 apply 就绪，故用可变引用 + 惰性读取
  let settingsService: SettingsWriteLike | undefined
  ctx.inject(['settings'], (settingsCtx) => {
    settingsService = (settingsCtx as unknown as { settings: SettingsWriteLike }).settings
    ctx.logger.info('[dsh-switch-preset] settings 服务已就绪（写默认模式可用）')
  })

  registerSwitchPresetCommands(ctx as unknown as PluginContext, () => settingsService)
  ctx.logger.info(`[dsh-switch-preset] v${VERSION} loaded`)
}