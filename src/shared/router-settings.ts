/**
 * shared/router-settings.ts — `/router-preset` 的路由参数（Host/Client 共享，默认值单一真源）
 *
 * v0.5.1（2026-09-28，闭合 spec 002 的未决项 U1）：
 *   用户更早一轮原话「并在插件设置页面可设置开启或关闭是否识别后执行切换」→
 *   本轮落地两个真实可配参数，经 **0.1.7 原生设置面**（插件行 volatile 字段
 *   `routerSettings`）读写，并注册到插件页配置区 `plugins.bundle.config`。
 *
 * 两个参数（用户 2026-09-28 本轮口径）：
 *   1. `routerEnabled`（boolean，默认 true）：关闭时 `/router-preset` **只做概率判定与展示，
 *      不切换、不投递**（输出里明确说明"自动切换已关闭"）。
 *   2. `routerThreshold`（number，默认 0.6，范围 0–1）：达阈值才自动切换，语义不变。
 *      阈值上限/下限校验在 host 侧做，非法值**不得导致崩溃**（回落默认）。
 *
 * 为什么归一化与 schema 放在 shared：
 *   - 默认值 0.6 的单一真源在 `shared/threshold.ts` 的 `DEFAULT_ROUTE_THRESHOLD`
 *     （`host/route.ts` 也复用它并以同名再导出），本模块**从那里取**做 schema default
 *     与运行时回落，避免第二份 0.6；
 *   - host（schema/归一化）与 client（卡片初值/校验提示）共用同一套边界，
 *     不会出现"UI 允许 1.5 但 host 落回 0.6"的口径分裂。
 */
import z from '@deepseek-ai/schemastery'
import { DEFAULT_ROUTE_THRESHOLD } from './threshold.ts'

/** 一个参数（`routerSettings` 的 volatile 字段名）。 */
export type RouterSettingKey = keyof RouterSettings

/** 路由参数（两个字段，正好闭合 U1）。 */
export interface RouterSettings {
  /** 是否允许 `/router-preset` 在达阈值时**自动切换**（关闭 = 只判定与展示）。 */
  readonly routerEnabled: boolean
  /** 自动切换阈值，[0,1]，默认 0.6（低于它只提示）。 */
  readonly routerThreshold: number
}

/** 阈值合法区间（上下限；host 侧校验用，client 侧同口径提示用）。 */
export const ROUTER_THRESHOLD_MIN = 0
export const ROUTER_THRESHOLD_MAX = 1

/** 出厂默认（阈值复用 host/route.ts 的 DEFAULT_ROUTE_THRESHOLD，单一真源）。 */
export const DEFAULT_ROUTER_SETTINGS: RouterSettings = {
  routerEnabled: true,
  routerThreshold: DEFAULT_ROUTE_THRESHOLD,
} as const

/**
 * 阈值归一化：非法值（非有限数 / 越界）一律回落默认 0.6。
 *
 * 这是"非法值不得导致崩溃"的**运行时真源**（host 侧每个消费点都过它）：
 * 配置文件被手改成 `routerThreshold: 5` 时不会抛错、不会切错，只是回落默认。
 */
export function normalizeRouterThreshold(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ROUTE_THRESHOLD
  if (value < ROUTER_THRESHOLD_MIN || value > ROUTER_THRESHOLD_MAX) return DEFAULT_ROUTE_THRESHOLD
  return value
}

/** 任意（可能损坏的）配置对象 → 合法参数（缺字段补默认，非法阈值回落）。 */
export function normalizeRouterSettings(value: unknown): RouterSettings {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  return {
    routerEnabled: typeof raw.routerEnabled === 'boolean' ? raw.routerEnabled : DEFAULT_ROUTER_SETTINGS.routerEnabled,
    routerThreshold: normalizeRouterThreshold(raw.routerThreshold),
  }
}

/** 是否合法阈值（client 保存前自检；与 normalize 同口径）。 */
export function isValidRouterThreshold(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= ROUTER_THRESHOLD_MIN && value <= ROUTER_THRESHOLD_MAX
}

/** 参数字段名清单（host 写入白名单 / client 表单字段用，避免两处各写一份）。 */
export const ROUTER_SETTING_KEYS: readonly RouterSettingKey[] = ['routerEnabled', 'routerThreshold']

/**
 * 0.1.7 原生设置面 schema（照 `dsh-minesweeper` 范式）：
 *   - `z.object(...).default({}).volatile()` → 读 = `config.routerSettings.get()`；
 *   - 字段名 `routerSettings` 即 settings.mutate 的路径根（`['routerSettings', <key>]`）。
 */
export const RouterSettingsSchema = z.object({
  routerEnabled: z.boolean().default(DEFAULT_ROUTER_SETTINGS.routerEnabled),
  routerThreshold: z
    .number()
    .min(ROUTER_THRESHOLD_MIN)
    .max(ROUTER_THRESHOLD_MAX)
    .default(DEFAULT_ROUTER_SETTINGS.routerThreshold),
})

/** 插件行配置：0.1.7 原生设置面 = 本条的 volatile 字段 `routerSettings`。 */
export const Config = z.object({
  routerSettings: RouterSettingsSchema.default({}).volatile(),
  /**
   * v0.6.0：dsh-kb 知识库根目录（/router-preset-memory 记忆加载用）。
   * 与 daily-workbench 的 `kbRoot` 同字段名（本机解析后的绝对路径）。
   * 未配置/为空 → loadMemoryContext 的四层回退兜底，命令不失效。
   */
  kbRoot: z.string().default('').volatile(),
})
