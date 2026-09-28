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
 * v0.5.0（2026-09-28）：新增 `/router-preset` 概率路由（判定 → 达阈值切换 → 原话 Host 侧投递）。
 * v0.5.1（2026-09-28，闭合 spec 002 未决项 U1）：
 *   4. **真实可配参数**：插件行声明 volatile 设置字段 `routerSettings`
 *      （`routerEnabled` 默认 true；`routerThreshold` 默认 0.6，范围 0–1，非法回落），
 *      读 = `config.routerSettings.get()`，写 = `settings.mutate(entryId, [['routerSettings', k]], revision)`；
 *   5. **插件页配置区**：自带 REST 数据面（`/api/dsh-switch-preset/settings*`），
 *      客户端在 `plugins.bundle.config`（key = **包名** `dsh-switch-preset`）注册配置卡片。
 *      静态 `inject` 仍保持为空（见上面 v2.0 教训）；`webServer`/`settings` 走二级注入 +
 *      `cordis.patch.yml` 的 inject 声明，缺失时静默降级（仅影响配置卡片，命令不受影响）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerSwitchPresetCommands, type SessionControllerLike } from './host/command.ts'
import { Config, createRouterSettingsFacade, registerRouterSettingsRoutes } from './host/settings.ts'
import type { PluginContext, SettingsLike } from './host/types.ts'

/** 插件 id（bundle 注册名）。 */
export const name = 'dsh-switch-preset'

/**
 * 静态依赖声明。
 *
 * 这里**不能放 `commands`**：0.1.7 的 `commands` 是作用域服务，静态声明会让插件
 * 永远等不到它、apply 静默不执行（2026-09-23 实测根因，详见文件头 v2.0）。
 * 命令注册改用下面的二级注入；`sessionProjections` 走 `ctx.get` 惰性取用（缺失即降级）。
 * v0.5.1 起 `webServer`（配置数据面）同样走二级注入，插件级静态 inject 仍为空。
 */
export const inject: string[] = []

/** 与 package.json version 同步（四处同步，改版本必同步本行）。 */
export const VERSION = '0.5.1'

/**
 * 0.1.7 原生设置面（v0.5.1）：插件行 volatile 字段 `routerSettings`。
 * 再导出 `Config` 供 loader 解析（schema 定义在 `host/settings.ts`，字段来自 `shared/router-settings.ts`）。
 */
export { Config }

/** 在 Web 交互式界面运行时注册 /switch-preset 与 /list-preset。 */
export function apply(ctx: Context, config?: { routerSettings?: { get?: () => unknown } }): void {
  // settings 服务晚于 apply 就绪 → 可变引用 + 命令执行时惰性读取（v0.2.1 起的既定做法）
  let settingsService: SettingsLike | undefined
  ctx.inject(['settings'], (settingsCtx) => {
    settingsService = (settingsCtx as unknown as { settings: SettingsLike }).settings
    ctx.logger.info('[dsh-switch-preset] settings 服务已就绪（写默认模式可用）')
  })

  // sessionController（core API 服务）：/router-preset 第③步把原话投递进会话的唯一通道。
  // 同样惰性解析（晚于 apply 就绪也不影响；缺失时命令会如实报告"未投递"）。
  let sessionController: SessionControllerLike | undefined
  ctx.inject(['sessionController'], (scCtx) => {
    sessionController = (scCtx as unknown as { sessionController: SessionControllerLike }).sessionController
    ctx.logger.info('[dsh-switch-preset] sessionController 已就绪（/router-preset 可投递原话）')
  })

  // v0.5.1 设置面：读插件行 volatile 字段（loader 维护的当前值），写走 settings.mutate。
  // 门面自身不依赖 settings 服务即可读（服务缺失时写会给出明确错误，卡片据此提示）。
  const facade = createRouterSettingsFacade(
    ctx as unknown as Parameters<typeof createRouterSettingsFacade>[0],
    config,
  )

  // 配置数据面（插件页配置区卡片经 REST 读写）。webServer 缺失即静默跳过：
  // 非 web profile 仍能加载本插件，三条命令语义不受影响。
  ctx.inject(['webServer'], (webCtx) => {
    const ws = (webCtx as unknown as { webServer?: Parameters<typeof registerRouterSettingsRoutes>[0] }).webServer
    webCtx.effect?.(() => {
      registerRouterSettingsRoutes(ws, facade)
      return () => {}
    }, 'dsh-switch-preset: settings routes')
    ctx.logger.info('[dsh-switch-preset] 设置数据面已注册（/api/dsh-switch-preset/settings）')
  })

  // 命令注册必须走二级注入（见文件头 v2.0）：拿到带 commands 的孩子上下文后用它注册，
  // disposer 随该注入生命周期回收。v0.5.1 起把路由参数读取器一并注入（每次执行惰性取值）。
  ctx.inject(['commands', 'agentPresets'], (commandCtx) => {
    registerSwitchPresetCommands(
      commandCtx as unknown as PluginContext,
      () => settingsService,
      () => sessionController,
      () => facade.getSettings(),
    )
  })

  ctx.logger.info(`[dsh-switch-preset] v${VERSION} loaded`)
}
