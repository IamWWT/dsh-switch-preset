/**
 * host/settings.ts — dsh-switch-preset 的**0.1.7 原生设置面**（v0.5.1）
 *
 * 照工作区已验证范式 `dsh-minesweeper/src/index.ts` + `src/host/routes.ts` 实现，不自创：
 *   - 读：插件行 volatile 字段 `routerSettings`（loader 维护的当前值，`config.routerSettings.get()`）；
 *   - 写：`settings.mutate(entryId, [{op:'set', path:['routerSettings', <key>], value}], revision)`
 *         —— `entryId` 取 `c.fiber?.entry?.options?.id`（命名空间 = profile 条目 id，非包名）；
 *   - 热更新：`ctx.on('loader/volatile-update', paths)`（paths[0] === 'routerSettings'）；
 *   - 数据面：自带 REST 路由（`/api/dsh-switch-preset/settings` `GET|PUT`，`/settings/watch` 长轮询），
 *            供插件页配置区卡片读写（0.1.7 已移除 `settingsScope` 服务）。
 *
 * 归属说明（为什么放在 host/ 而不是 src/index.ts）：
 *   `src/index.ts` 是 `Config` 的导出点（plugin Config schema 约定），业务面放在本模块，
 *   与 minesweeper 把路由/门面分文件的布局一致。
 *
 * 非法值语义（用户 2026-09-28 口径）：阈值上下限校验在 host 侧做——
 *   写入前校验（越界/非数 → 400 明确文案），读取时归一化（配置被手改坏 → 回落 0.6），
 *   两条路都不抛未捕获异常、不影响 `/switch-preset` 等既有能力。
 */
import {
  DEFAULT_ROUTER_SETTINGS,
  Config,
  KB_ROOT_FIELD,
  normalizeRouterSettings,
  ROUTER_SETTING_KEYS,
  type RouterSettings,
} from '../shared/router-settings.ts'

/** 设置命名空间兜底（`c.fiber.entry.options.id` 取不到时用；应为包名）。 */
export const SETTINGS_NAMESPACE = 'dsh-switch-preset'

export { DEFAULT_ROUTER_SETTINGS, Config, type RouterSettings }

/** volatile 字段名（settings.mutate 的路径根，与 `Config` 的字段名一致）。 */
export const SETTINGS_FIELD = 'routerSettings'

/** 0.1.7 settings 服务最小契约（SettingsForms：describe/mutate）。 */
export interface SettingsServiceLike {
  describe?: () => Array<{ ns?: string; revision?: number }>
  mutate?: (
    ns: string,
    ops: Array<{ op: 'set' | 'unset'; path: string[]; value?: unknown }>,
    expectedRevision?: number,
  ) => Promise<unknown>
}

/** 设置写入门面入参（与 minesweeper 的 settings-api 契约一致：卡片可只传 fields）。 */
export interface SettingsWriteInput {
  fields?: Record<string, unknown>
  clear?: string[]
  expectedRevision?: number
}

/** 设置读写门面（路由层用；缺失时设置端点不注册，命令仍按默认值工作）。 */
export interface RouterSettingsFacade {
  getSettings(): RouterSettings
  /** v0.6.1：读 kbRoot 当前值（volatile/普通字符串/缺失 → ''，绝不抛）。 */
  getKbRoot(): string
  currentRevision(): number
  write(input: SettingsWriteInput): Promise<{ revision: number }>
  watch(timeoutMs: number): Promise<{ changed: boolean; revision: number }>
}

/** 最小 host 上下文面（只声明本模块消费的属性）。 */
export interface SettingsHostContext {
  get?: (key: string) => unknown
  on?: (event: string, listener: (...args: unknown[]) => void) => () => void
  fiber?: { entry?: { options?: { id?: string } } }
}

/** 插件行配置对象面（loader 解析后的 volatile 引用）。 */
export interface RouterSettingsConfigLike {
  get?: () => unknown
}

/**
 * 校验一次写入（host 侧边界，铁律 #8 显式失败：非法值给明确错误，不静默吞）。
 *
 * @param input - 卡片/REST 的写入意图
 * @returns 规范化后的 mutate ops
 * @throws 未知字段名 / 空操作 / 阈值越界或非数
 */
export function buildWriteOps(
  input: SettingsWriteInput,
): Array<{ op: 'set' | 'unset'; path: string[]; value?: unknown }> {
  const isKnown = (key: string): boolean =>
    (ROUTER_SETTING_KEYS as readonly string[]).includes(key) || key === KB_ROOT_FIELD

  for (const key of Object.keys(input.fields ?? {})) {
    if (!isKnown(key)) throw new Error(`未知设置项：${key}`)
  }
  for (const key of input.clear ?? []) {
    if (!isKnown(key)) throw new Error(`未知设置项：${key}`)
  }

  const fields = input.fields ?? {}
  const threshold = fields.routerThreshold
  if (threshold !== undefined) {
    if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
      throw new Error('阈值必须是数字（0–1）')
    }
    if (threshold < 0 || threshold > 1) {
      throw new Error(`阈值超出范围：${threshold}（必须在 0–1 之间）`)
    }
  }
  const enabled = fields.routerEnabled
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    throw new Error('自动切换开关必须是布尔值')
  }
  const kbRoot = fields[KB_ROOT_FIELD]
  if (kbRoot !== undefined && typeof kbRoot !== 'string') {
    throw new Error('知识库路径（kbRoot）必须是字符串')
  }

  /** v0.6.1：kbRoot 是 Config **独立** volatile 字段（路径 `['kbRoot']`），router 参数是对象内子路径。 */
  const pathOf = (key: string): string[] => (key === KB_ROOT_FIELD ? [KB_ROOT_FIELD] : [SETTINGS_FIELD, key])

  const ops = [
    ...Object.entries(fields).map(([k, v]) => ({ op: 'set' as const, path: pathOf(k), value: v })),
    ...(input.clear ?? []).map(k => ({ op: 'unset' as const, path: pathOf(k), value: undefined })),
  ]
  if (ops.length === 0) throw new Error('fields/clear 至少其一')
  return ops
}

/**
 * 构造设置门面（0.1.7 原生路径）。
 *
 * @param c - host 上下文（取 settings 服务、事件总线、fiber entry id）
 * @param config - 插件行配置（`config.routerSettings` / `config.kbRoot` 均为 loader 维护的 volatile 引用）
 */
export function createRouterSettingsFacade(
  c: SettingsHostContext,
  config?: { routerSettings?: RouterSettingsConfigLike; kbRoot?: unknown },
): RouterSettingsFacade {
  const settingsService = (typeof c.get === 'function' ? c.get('settings') : undefined) as
    | SettingsServiceLike
    | null
    | undefined
  const settingsNs = c.fiber?.entry?.options?.id || SETTINGS_NAMESPACE

  /** 读当前值：volatile 引用异常/损坏一律回落默认（绝不抛给命令层）。 */
  const getSettings = (): RouterSettings => {
    try {
      const doc = typeof config?.routerSettings?.get === 'function' ? config.routerSettings.get() : undefined
      return normalizeRouterSettings(doc)
    } catch {
      return { ...DEFAULT_ROUTER_SETTINGS }
    }
  }

  /** v0.6.1：读 kbRoot 当前值（volatile 包装 / 普通字符串 / 缺失 → ''；绝不抛）。 */
  const getKbRoot = (): string => {
    try {
      const raw = config?.kbRoot
      const inner = typeof raw === 'object' && raw !== null && typeof (raw as { get?: unknown }).get === 'function'
        ? (raw as { get: () => unknown }).get()
        : raw
      return typeof inner === 'string' ? inner : ''
    } catch {
      return ''
    }
  }

  const currentRevision = (): number => {
    try {
      const rows = settingsService?.describe?.() ?? []
      const row = rows.find(r => r?.ns === settingsNs)
      return typeof row?.revision === 'number' ? row.revision : 0
    } catch {
      return 0
    }
  }

  const facade: RouterSettingsFacade = {
    getSettings,
    getKbRoot,
    currentRevision,
    async write(input: SettingsWriteInput) {
      const ops = buildWriteOps(input)
      if (!settingsService?.mutate) throw new Error('settings 服务不可用，无法保存')
      await settingsService.mutate(settingsNs, ops, input.expectedRevision)
      return { revision: currentRevision() }
    },
    watch(timeoutMs: number) {
      return new Promise(resolve => {
        let settled = false
        const finish = (changed: boolean): void => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          off()
          resolve({ changed, revision: currentRevision() })
        }
        const timer = setTimeout(() => finish(false), Math.max(2000, Math.min(timeoutMs, 25_000)))
        const off = typeof c.on === 'function'
          ? c.on('loader/volatile-update', (paths: unknown) => {
              const list = Array.isArray(paths) ? (paths as unknown[]) : []
              // v0.6.1：kbRoot（独立字段）变更也要触发热同步，卡片才能跟随配置卡保存。
              if (list.some(p => Array.isArray(p) && (p[0] === SETTINGS_FIELD || p[0] === KB_ROOT_FIELD))) finish(true)
            })
          : () => {}
      })
    },
  }
  return facade
}

/* ------------------------------------------------------------------ *
 * REST 数据面（插件页配置区卡片读写；0.1.7 已移除 settingsScope 服务）
 * ------------------------------------------------------------------ */

/** 最小请求对象面（Node http.IncomingMessage 的子集）。 */
type Req = {
  method?: string
  url?: string
  on: (ev: 'data' | 'end' | 'error', fn: (chunk?: unknown, err?: unknown) => void) => void
  destroy: () => void
}

/** 最小响应对象面。 */
type Res = {
  writeHead: (status: number, headers?: Record<string, string>) => void
  end: (body?: string) => void
}

/** webServer 注册面（0.1.7 `WebRoute`：kind/path/handler）。 */
export interface WebServerLike {
  register?: (route: { kind: 'exact' | 'prefix'; path: string; handler: (req: unknown, res: unknown) => void | Promise<void> }) => unknown
}

function sendJson(res: Res, status: number, obj: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(obj))
}

/** 读请求体：**只读 req**（传 res 会永久挂起——工作区铁律/历史事故）。 */
function readBody(req: Req, limit = 64 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let size = 0
    req.on('data', (chunk?: unknown) => {
      const c = chunk as Buffer | undefined
      if (!c) return
      size += c.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(new Uint8Array(c.buffer, c.byteOffset, c.byteLength))
    })
    req.on('end', () => resolve(Buffer.concat(chunks as unknown as readonly Uint8Array[]).toString('utf-8')))
    req.on('error', reject)
  })
}

/** 从 url 取查询参数（watch 的 timeoutMs）。 */
function queryOf(url: string | undefined, key: string): number | undefined {
  if (!url) return undefined
  const q = url.indexOf('?')
  if (q < 0) return undefined
  const value = new URLSearchParams(url.slice(q + 1)).get(key)
  if (value === null) return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

/** 写失败 → HTTP 状态（越界/未知字段/空操作 = 400；revision 冲突 = 409；其余 500）。 */
function statusOf(error: unknown): number {
  const msg = String((error as { message?: string })?.message ?? error)
  if (/revision/i.test(msg)) return 409
  if (/未知设置项|至少其一|超出范围|必须是数字|必须是布尔/.test(msg)) return 400
  return 500
}

/**
 * 注册设置数据面路由（webServer 缺失时静默跳过：插件在非 web profile 仍可加载）。
 *
 *   GET    /api/dsh-switch-preset/settings         → { value, revision, writable }
 *   PUT    /api/dsh-switch-preset/settings         → { fields?, clear?, expectedRevision? } → { ok, revision }
 *   GET    /api/dsh-switch-preset/settings/watch?timeoutMs=  → 长轮询 { changed, revision }
 *
 * 使用 `kind: 'exact'`（与 minesweeper 同惯例）：精确路径匹配（query 不参与匹配，
 * 故 `/settings` 与 `/settings?x=1` 命中同一路由）。
 */
export function registerRouterSettingsRoutes(ws: WebServerLike | null | undefined, facade: RouterSettingsFacade): void {
  if (!ws || typeof ws.register !== 'function') return
  const register = ws.register.bind(ws)

  const handleSettings = async (req: Req, res: Res): Promise<void> => {
    const method = req.method || 'GET'
    if (method === 'GET') {
      try {
        sendJson(res, 200, {
          value: { ...facade.getSettings(), kbRoot: facade.getKbRoot() },
          revision: facade.currentRevision(),
          writable: true,
        })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String((error as { message?: string })?.message ?? error) })
      }
      return
    }
    if (method !== 'PUT') {
      sendJson(res, 405, { ok: false, error: `不支持的方法：${method}` })
      return
    }
    let body: SettingsWriteInput
    try {
      const text = await readBody(req)
      const parsed: unknown = text ? JSON.parse(text) : {}
      if (parsed === null || typeof parsed !== 'object') throw new Error('bad-body')
      body = parsed as SettingsWriteInput
    } catch {
      sendJson(res, 400, { ok: false, error: 'bad-json' })
      return
    }
    try {
      const out = await facade.write(body)
      sendJson(res, 200, {
        ok: true,
        revision: out.revision,
        value: { ...facade.getSettings(), kbRoot: facade.getKbRoot() },
      })
    } catch (error) {
      sendJson(res, statusOf(error), {
        ok: false,
        error: String((error as { message?: string })?.message ?? error),
      })
    }
  }

  const handleWatch = async (req: Req, res: Res): Promise<void> => {
    try {
      const out = await facade.watch(queryOf(req.url, 'timeoutMs') ?? 25_000)
      sendJson(res, 200, out)
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String((error as { message?: string })?.message ?? error) })
    }
  }

  const byPath: Record<string, (req: Req, res: Res) => Promise<void>> = {
    '/api/dsh-switch-preset/settings': handleSettings,
    '/api/dsh-switch-preset/settings/watch': handleWatch,
  }

  for (const [path, handler] of Object.entries(byPath)) {
    register({
      kind: 'exact',
      path,
      handler: async (req: unknown, res: unknown) => {
        const r = req as Req
        try {
          await handler(r, res as Res)
        } catch (error) {
          // 兜底：任何未预期异常都转成明确 JSON，绝不让请求悬空
          try {
            sendJson(res as Res, 500, { ok: false, error: String((error as { message?: string })?.message ?? error) })
          } catch { /* 响应已结束：忽略 */ }
        }
      },
    })
  }
}
