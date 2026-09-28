/**
 * client/settings-api.ts — 插件页配置区卡片的**数据面适配器**（v0.5.1）
 *
 * 照 `dsh-minesweeper/src/client/settings-api.ts` 范式：0.1.7 已移除客户端 `settingsScope`
 * 服务，卡片改走**插件自有 REST 路由**（`/api/dsh-switch-preset/settings*`，Host 侧见
 * `src/host/settings.ts`），本适配器暴露与旧 binder scope 相同的最小面
 * （getSnapshot / subscribe / set / unset），卡片代码因此不感知传输层。
 *
 * 纪律：
 *   - 所有请求都带超时（AbortSignal.timeout），失败/超时给明确文案，绝不无限转圈；
 *   - 失败**必须抛错并把服务端文案带出来**（卡片据此显示"失败明确文案"，铁律 #8）；
 *   - 写失败保留原 revision 不推进，下一次写仍会带正确的乐观锁版本。
 */

/** 与 settings-card.ts 的 SettingsScopeLike 一致（此处为真源）。 */
export interface ApiSettingsScope {
  getSnapshot(): { status?: string; value?: Record<string, unknown>; revision?: number; error?: string } | null
  subscribe(listener: () => void): () => void
  /** 写入一个字段；失败抛 `SettingsWriteError`（含服务端文案/状态码）。 */
  set(field: string, value: unknown): Promise<void>
  /** 一次写入多个字段（后端一次 mutate，避免"一半成功"的中间态）。 */
  setFields(fields: Record<string, unknown>): Promise<void>
  unset(field: string): Promise<void>
}

/** 写入失败（带状态码与服务端文案，供卡片显示明确原因）。 */
export class SettingsWriteError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'SettingsWriteError'
    this.status = status
  }
}

/** 单次请求超时（读 8s / 写 10s；watch 用自身的长轮询时长 + 余量）。 */
function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined
}

/** 把非 2xx 响应解析成带文案的错误（服务端返回 { error }）。 */
async function failureOf(response: Response, fallback: string): Promise<SettingsWriteError> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body?.error === 'string') detail = body.error
  } catch {
    /* 非 JSON 响应：用兜底文案 */
  }
  return new SettingsWriteError(detail || fallback, response.status)
}

export function createApiSettingsScope(baseUrl: string): ApiSettingsScope {
  let snapshot: { status: string; value: Record<string, unknown>; revision: number; error?: string } = {
    status: 'pending',
    value: {},
    revision: 0,
  }
  let lastRevision = 0
  const listeners = new Set<() => void>()
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let polling = false
  let disposed = false

  const emit = (): void => {
    for (const fn of [...listeners]) {
      try {
        fn()
      } catch {
        /* 单个监听器异常不影响其它 */
      }
    }
  }

  const refresh = async (): Promise<void> => {
    if (disposed) return
    try {
      const r = await fetch(`${baseUrl}/settings`, { cache: 'no-store', signal: timeoutSignal(8000) })
      if (!r.ok) {
        snapshot = { status: 'unavailable', value: {}, revision: lastRevision, error: `HTTP ${r.status}` }
        return
      }
      const data = (await r.json()) as { value?: Record<string, unknown>; revision?: number }
      lastRevision = typeof data.revision === 'number' ? data.revision : lastRevision
      snapshot = { status: 'ok', value: data.value ?? {}, revision: lastRevision }
    } catch (error) {
      snapshot = {
        status: 'unavailable',
        value: {},
        revision: lastRevision,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /** 长轮询：Host 侧 `/settings/watch` 挂起到设置变化或超时（返回 changed）。 */
  const poll = async (): Promise<void> => {
    if (disposed || polling) return
    polling = true
    try {
      while (!disposed) {
        const started = Date.now()
        try {
          const r = await fetch(`${baseUrl}/settings/watch?timeoutMs=25000`, {
            cache: 'no-store',
            signal: timeoutSignal(30_000),
          })
          if (r.ok) {
            const out = (await r.json()) as { changed?: boolean }
            if (out.changed) {
              await refresh()
              emit()
            }
          }
        } catch {
          /* 网络抖动/超时：下一轮继续 */
        }
        const elapsed = Date.now() - started
        if (elapsed < 24_000) await new Promise(res => setTimeout(res, Math.min(1500, 24_000 - elapsed)))
      }
    } finally {
      polling = false
    }
  }

  const startPolling = (): void => {
    if (pollTimer || disposed) return
    pollTimer = setTimeout(() => {
      pollTimer = null
      void poll()
    }, 50)
  }

  const write = async (payload: Record<string, unknown>, label: string): Promise<void> => {
    let r: Response
    try {
      r = await fetch(`${baseUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, expectedRevision: lastRevision }),
        signal: timeoutSignal(10_000),
      })
    } catch (error) {
      throw new SettingsWriteError(
        error instanceof Error && error.name === 'TimeoutError'
          ? `${label}超时（10s）：设置服务未在预期时间内响应`
          : `${label}失败：${error instanceof Error ? error.message : String(error)}`,
        0,
      )
    }
    if (!r.ok) throw await failureOf(r, `${label}失败：HTTP ${r.status}`)
    await refresh()
    emit()
  }

  void refresh()
  startPolling()

  return {
    getSnapshot() {
      return { ...snapshot }
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      startPolling()
      return () => {
        listeners.delete(listener)
      }
    },
    set(field: string, value: unknown): Promise<void> {
      return write({ fields: { [field]: value } }, '保存设置')
    },
    setFields(fields: Record<string, unknown>): Promise<void> {
      return write({ fields }, '保存设置')
    },
    unset(field: string): Promise<void> {
      return write({ clear: [field] }, '重置设置')
    },
  }
}
