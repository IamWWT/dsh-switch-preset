/**
 * client/settings-card.ts — 插件页配置区卡片（v0.5.1，闭合 spec 002 未决项 U1）
 *
 * 形态：注册在 `plugins.bundle.config`（**keyed 槽，key = 包名 `dsh-switch-preset`**）下的
 * 一张卡片，渲染在「左侧栏 → 插件 → dsh-switch-preset」详情页的正文里（`view === 'page'`）。
 *
 * 两个控件（对应用户"能在设置页开关自动切换"的原话 + 阈值可配）：
 *   1. 「自动切换」开关（`routerEnabled`，默认开）：关闭时 `/router-preset` 只判定与展示，
 *      不切换、不投递——文案把这条后果写清楚，避免用户以为只是"静音"。
 *   2. 「判定阈值」数字框（`routerThreshold`，默认 0.6，范围 0–1）：达阈值才自动切换。
 *
 * 数据面：`settings-api.ts` 的 REST 适配器（0.1.7 无 settingsScope 服务）。
 * 纪律：
 *   - 只用 `--dsw-*` 主题 token（明暗自动跟随），不写死色值；
 *   - 保存失败/超时给**明确文案**（含服务端原因），并保留用户改动不回滚（可重试）；
 *   - 阈值越界在客户端先拦（与 host 侧同口径），不把非法值发给服务端；
 *   - hook 数量按分支稳定（不做条件 hook）。
 */
import {
  DEFAULT_ROUTER_SETTINGS,
  isValidRouterThreshold,
  ROUTER_THRESHOLD_MAX,
  ROUTER_THRESHOLD_MIN,
} from '../shared/router-settings.ts'

/** 最小 React 形状（宿主 ModuleLoader 的 require('react') 提供，禁止 bundle 第二份）。 */
type ReactLike = {
  createElement: (...args: unknown[]) => unknown
  useState: <T>(init: T | (() => T)) => [T, (v: T | ((prev: T) => T)) => void]
  useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]) => void
  useRef: <T>(init: T) => { current: T }
}

/** 设置数据面（`createApiSettingsScope` 实现；不可用时为 null）。 */
export interface SettingsScopeLike {
  getSnapshot(): { status?: string; value?: Record<string, unknown>; revision?: number; error?: string } | null
  subscribe(listener: () => void): () => void
  /** 写入多个字段（后端一次 mutate，避免"一半成功"的中间态）。 */
  setFields?(fields: Record<string, unknown>): Promise<void>
  /** 兼容旧面：单字段写入。 */
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
}

export interface SettingsCardDeps {
  React: ReactLike
  /** 数据面；不可用时卡片降级为只读提示（不崩、不误导）。 */
  scope: SettingsScopeLike | null
}

export interface SettingsCardUI {
  Card: (props: Record<string, unknown>) => unknown
}

const THEME = {
  labelPrimary: 'var(--dsw-alias-label-primary)',
  labelSecondary: 'var(--dsw-alias-label-secondary)',
  border: 'var(--dsw-alias-border-l2)',
  fill: 'var(--dsw-alias-interactive-bg-hover)',
  danger: 'var(--dsw-alias-state-error-primary)',
  success: 'var(--dsw-alias-state-success-primary)',
} as const

/** 一行标签 + 控件的布局。 */
const ROW_STYLE = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 } as const
const LABEL_STYLE = { minWidth: 96, color: THEME.labelPrimary, fontSize: 13 } as const
const NOTE_STYLE = { marginTop: 10, color: THEME.labelSecondary, fontSize: 12, lineHeight: 1.6 } as const

export function createSettingsCard(deps: SettingsCardDeps): SettingsCardUI {
  const { React: R, scope } = deps
  const h = R.createElement as (t: unknown, p?: Record<string, unknown> | null, ...c: unknown[]) => unknown

  /**
   * 从快照读参数用于**表单显示**：如实显示当前存储值（越界也照显，不粉饰——保存时会被拦）。
   * 运行时回落（非法 → 0.6）发生在 host 侧（`normalizeRouterSettings`），这里不重复掩盖：
   * 否则用户会看到"0.6 已保存"而实际配置里躺着 5，无从发现。
   */
  const readFromScope = (): { enabled: boolean; threshold: string } => {
    try {
      const raw = scope?.getSnapshot()?.value ?? {}
      return {
        enabled: typeof raw.routerEnabled === 'boolean' ? raw.routerEnabled : DEFAULT_ROUTER_SETTINGS.routerEnabled,
        threshold: raw.routerThreshold === undefined
          ? String(DEFAULT_ROUTER_SETTINGS.routerThreshold)
          : String(raw.routerThreshold),
      }
    } catch {
      return { enabled: DEFAULT_ROUTER_SETTINGS.routerEnabled, threshold: String(DEFAULT_ROUTER_SETTINGS.routerThreshold) }
    }
  }

  const initial = readFromScope()

  const Card = function Card(_props: Record<string, unknown>) {
    const [enabled, setEnabled] = R.useState<boolean>(initial.enabled)
    const [thresholdText, setThresholdText] = R.useState<string>(initial.threshold)
    const [snapshotStatus, setSnapshotStatus] = R.useState<string>(() => scope?.getSnapshot()?.status ?? 'unavailable')
    const [saving, setSaving] = R.useState(false)
    const [notice, setNotice] = R.useState<string | null>(null)
    const [error, setError] = R.useState<string | null>(null)
    /** 已同步过的版本：只在新版本到达时刷新表单，避免覆盖用户正在编辑的输入。 */
    const syncedRevision = R.useRef<number>(-1)

    // 订阅数据面：外部（另一个标签页/命令行写入）变化时同步最新值。
    // 若本组件没有待保存改动就跟随；有改动时保留用户输入，避免覆盖正在编辑的内容。
    R.useEffect(() => {
      if (!scope || typeof scope.subscribe !== 'function') return undefined
      const sync = (): void => {
        try {
          const snap = scope.getSnapshot()
          setSnapshotStatus(snap?.status ?? 'unavailable')
          const revision = typeof snap?.revision === 'number' ? snap.revision : -1
          if (revision === syncedRevision.current) return
          syncedRevision.current = revision
          const latest = readFromScope()
          setEnabled(latest.enabled)
          setThresholdText(latest.threshold)
        } catch {
          /* 快照异常：保持上一次状态 */
        }
      }
      sync()
      const un = scope.subscribe(sync)
      return () => {
        try {
          un()
        } catch {
          /* 卸载失败忽略 */
        }
      }
    }, [])

    const thresholdValue = Number(thresholdText.trim() === '' ? Number.NaN : thresholdText)
    const thresholdValid = isValidRouterThreshold(thresholdValue)

    async function onSave(): Promise<void> {
      setError(null)
      setNotice(null)
      if (!thresholdValid) {
        setError(`阈值无效：请输入 ${ROUTER_THRESHOLD_MIN}–${ROUTER_THRESHOLD_MAX} 之间的数字（如 0.6）`)
        return
      }
      if (!scope) {
        setError('设置服务不可用，无法保存（可在 profile 配置里手写 config.routerSettings）')
        return
      }
      setSaving(true)
      try {
        const fields = { routerEnabled: enabled, routerThreshold: thresholdValue }
        if (typeof scope.setFields === 'function') {
          await scope.setFields(fields)
        } else {
          // 兜底：数据面只提供单字段写入时逐字段写（后写的失败会如实报错）
          await scope.set('routerEnabled', fields.routerEnabled)
          await scope.set('routerThreshold', fields.routerThreshold)
        }
        const synced = readFromScope()
        setThresholdText(synced.threshold)
        setNotice(
          `已保存：自动切换${enabled ? '开启' : '关闭'}，阈值 ${synced.threshold}`
            + '（下一次 /router-preset 生效）',
        )
      } catch (e) {
        setError(`保存失败：${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setSaving(false)
      }
    }

    function onReset(): void {
      setError(null)
      setNotice(null)
      setEnabled(DEFAULT_ROUTER_SETTINGS.routerEnabled)
      setThresholdText(String(DEFAULT_ROUTER_SETTINGS.routerThreshold))
    }

    if (!scope || snapshotStatus === 'unavailable') {
      return h(
        'div',
        { className: 'dshSwitchPresetCard', 'data-plugin-config': 'dsh-switch-preset' },
        h('div', { style: { fontWeight: 600, fontSize: 13, color: THEME.labelPrimary } }, '路由参数'),
        h(
          'div',
          { style: { ...NOTE_STYLE, color: THEME.danger } },
          '设置服务不可用：当前无法在此调整参数；'
            + '`/router-preset` 仍按默认值工作（自动切换开启、阈值 0.6）。',
        ),
      )
    }

    const controlStyle = {
      border: `1px solid ${THEME.border}`,
      borderRadius: 6,
      background: THEME.fill,
      color: THEME.labelPrimary,
      fontSize: 13,
      padding: '4px 8px',
    } as const

    return h(
      'div',
      { className: 'dshSwitchPresetCard', 'data-plugin-config': 'dsh-switch-preset' },
      h('div', { style: { fontWeight: 600, fontSize: 13, color: THEME.labelPrimary } }, '路由参数（/router-preset）'),

      h(
        'div',
        { style: ROW_STYLE },
        h('label', { style: LABEL_STYLE, htmlFor: 'dsh-switch-preset-routerEnabled' }, '自动切换'),
        h('input', {
          id: 'dsh-switch-preset-routerEnabled',
          type: 'checkbox',
          checked: enabled,
          disabled: saving,
          onChange: (e: { target?: { checked?: boolean } }) => {
            setEnabled(e?.target?.checked === true)
            setNotice(null)
            setError(null)
          },
          'aria-label': '按概率自动切换模式',
        }),
        h('span', { style: NOTE_STYLE }, enabled ? '开启：达阈值即自动切换并继续你的原话' : '关闭：只判定与展示，不切换'),
      ),

      h(
        'div',
        { style: ROW_STYLE },
        h('label', { style: LABEL_STYLE, htmlFor: 'dsh-switch-preset-routerThreshold' }, '判定阈值'),
        h('input', {
          id: 'dsh-switch-preset-routerThreshold',
          type: 'number',
          min: ROUTER_THRESHOLD_MIN,
          max: ROUTER_THRESHOLD_MAX,
          step: 0.05,
          value: thresholdText,
          disabled: saving,
          onChange: (e: { target?: { value?: string } }) => {
            setThresholdText(String(e?.target?.value ?? ''))
            setNotice(null)
            setError(null)
          },
          style: { ...controlStyle, width: 96, borderColor: thresholdValid ? THEME.border : THEME.danger },
          'aria-label': '自动切换的判定阈值（0–1）',
        }),
        h('span', { style: NOTE_STYLE }, `0–1，默认 ${DEFAULT_ROUTER_SETTINGS.routerThreshold}；低于它只提示不切换`),
      ),

      h(
        'div',
        { style: { ...ROW_STYLE, justifyContent: 'flex-start' } },
        h(
          'button',
          {
            type: 'button',
            onClick: () => void onSave(),
            disabled: saving,
            style: { ...controlStyle, cursor: saving ? 'progress' : 'pointer', opacity: saving ? 0.6 : 1 },
          },
          saving ? '保存中…' : '保存',
        ),
        h(
          'button',
          { type: 'button', onClick: onReset, disabled: saving, style: { ...controlStyle, cursor: 'pointer' } },
          '恢复默认',
        ),
      ),

      error === null
        ? null
        : h('div', { role: 'alert', style: { ...NOTE_STYLE, color: THEME.danger, whiteSpace: 'pre-wrap' } }, error),
      notice === null
        ? null
        : h('div', { role: 'status', style: { ...NOTE_STYLE, color: THEME.success } }, notice),

      h(
        'div',
        { style: NOTE_STYLE },
        '关闭「自动切换」后，`/router-preset <原话>` 仍会给出完整概率判定，但**不切换模式、也不投递你的原话**，'
          + `需要时用 /switch-preset <id> 手动切换。当前设置：自动切换${enabled ? '开启' : '关闭'}`
          + `，阈值 ${thresholdValid ? thresholdValue : '（输入非法，保存会被拒绝）'}。`,
      ),
    )
  }

  return { Card }
}
