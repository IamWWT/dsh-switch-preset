/**
 * DSH 插件 Host 入口 — dsh-switch-preset
 *
 * 导出形态红线（PLUGIN-DEV-STANDARD §4.1）：一律具名导出，禁止 export default
 * （default export 会丢失 inject 声明）。版本四处同步（§2.4）。
 *
 * v1.1（2026-09-17）：切换语义 = 留在当前会话（空会话就地 select / 已开始会话写默认模式）。
 * v0.2.1（2026-09-18）：修复「设置服务不可用」——settings 必须经 `ctx.inject(['settings'], cb)`
 *   二次注入获取（直接 `ctx.get('settings')` 返回 undefined）；命令执行时惰性解析。
 * v2.0（2026-09-23，harness 0.1.7 原地对齐）：
 *   1. **挂载修复（本版本核心）**：旧版把 `commands` 写进插件级静态 `inject`，在 0.1.7 上
 *      Cordis 的 inject 门控**永不满足 → apply 根本不执行**——模块被 import 了，命令却
 *      从未注册，`/list-preset` 毫无输出（实测：模块 import 有日志、apply 首行日志不出现）。
 *      现改为 0.1.7 原生范式（与工作区里能正常工作的 gateway-compaction 一致）：
 *      命令注册走 `ctx.inject(['commands', …], (cctx) => cctx.commands.register(...))`。
 *   2. **设置面迁移**：写「默认模式」不再用旧命名空间（0.1.7 不存在 `agent-presets` 条目），
 *      改为 `ctx.settings.mutate('agent-preset-registry', [{op:'set',path:['selectedDefault']}])`。
 *   3. 切换语义不变：空会话就地 `select`；已开始会话在用户明确要求下 `recompose` 重装配
 *      （框架抛 `agent-preset/locked`，本插件显式放行并提示副作用）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerSwitchPresetCommands } from './host/command.ts'
import type { PluginContext, SettingsLike } from './host/types.ts'

/** 插件 id（bundle 注册名）。 */
export const name = 'dsh-switch-preset'

/**
 * 静态依赖声明。
 *
 * 这里**不能放 `commands`**：0.1.7 的 `commands` 是作用域服务，静态声明会让插件
 * 永远等不到它、apply 静默不执行（2026-09-23 实测根因，详见文件头 v2.0）。
 * 命令注册改用下面的二级注入；`sessionProjections` 走 `ctx.get` 惰性取用（缺失即降级）。
 */
export const inject: string[] = []

/** 与 package.json version 同步（四处同步，改版本必同步本行）。 */
export const VERSION = '0.4.0'

/** 在 Web 交互式界面运行时注册 /switch-preset 与 /list-preset。 */
export function apply(ctx: Context): void {
  // settings 服务晚于 apply 就绪 → 可变引用 + 命令执行时惰性读取（v0.2.1 起的既定做法）
  let settingsService: SettingsLike | undefined
  ctx.inject(['settings'], (settingsCtx) => {
    settingsService = (settingsCtx as unknown as { settings: SettingsLike }).settings
    ctx.logger.info('[dsh-switch-preset] settings 服务已就绪（写默认模式可用）')
  })

  // 命令注册必须走二级注入（见文件头 v2.0）：拿到带 commands 的孩子上下文后用它注册，
  // disposer 随该注入生命周期回收。
  ctx.inject(['commands', 'agentPresets'], (commandCtx) => {
    registerSwitchPresetCommands(commandCtx as unknown as PluginContext, () => settingsService)
  })

  ctx.logger.info(`[dsh-switch-preset] v${VERSION} loaded`)
}
