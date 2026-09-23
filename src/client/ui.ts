/**
 * client/ui.ts — dsh-switch-preset 的浏览器 UI（h 函数式，不依赖 JSX runtime）
 *
 * 单一组件：ModePickerButton（conversation.input.right）——模式选择器按钮 + 弹层列表。
 * 弹层显示每个模式的 中文名（preset id）+ 中文描述 + 默认模式标注；选中后经
 * `remote.commands.execute('/switch-preset <id>')` 复用 Host 命令逻辑（切换语义、
 * 校验、降级提示全部走命令通道，与键盘流共享一份实现）。
 *
 * 纪律：
 *   - CSS 一律 DSH 主题 token（--dsw-*），禁写死色值；
 *   - 异步一律带超时，失败/超时给明确文案，绝不无限转圈；
 *   - 组件内 hooks 数量按分支稳定（不得条件 hook）。
 */
import type { PresetRow } from '../shared/contracts.ts'

/** 最小 React 形状（运行时由宿主 ModuleLoader 的 require('react') 提供）。 */
export interface ReactLike {
  createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => unknown
  useState: <T>(init: T | (() => T)) => [T, (v: T | ((prev: T) => T)) => void]
  useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]) => void
}

/** 模式选择器对外依赖（由 entry.ts 注入真实实现）。 */
export interface PickerDeps {
  /** 拉取模式清单（0.1.7 roster：行 + modeSelectionEnabled），须带超时。 */
  fetchPresets: (signal: AbortSignal) => Promise<PickerRoster>
  /** 执行 `/switch-preset <id>`（remote.commands.execute 封装），须带超时。 */
  executeSwitch: (sessionId: string, presetId: string) => Promise<void>
}

/** 0.1.7 的 roster 形状：`remote.agentPresets.list()` 返回对象（不再是裸数组）。 */
export interface PickerRoster {
  readonly presets: readonly PresetRow[]
  readonly modeSelectionEnabled: boolean
}

export interface MakeUiOptions {
  React: ReactLike
  picker: PickerDeps
}

const THEME = {
  subtleFill: 'var(--dsw-alias-fill-quaternary)',
  labelPrimary: 'var(--dsw-alias-label-primary)',
  labelSecondary: 'var(--dsw-alias-label-secondary)',
  border: 'var(--dsw-alias-stroke-quaternary)',
  surface: 'var(--dsw-alias-surface-raised, var(--dsw-elevation-surface-raised))',
  shadow: 'var(--dsw-elevation-shadow-2, 0 4px 16px rgba(0,0,0,.12))',
  danger: 'var(--dsw-alias-state-error-primary)',
} as const

let RUNTIME: MakeUiOptions | null = null
function getRuntime(): MakeUiOptions {
  if (!RUNTIME) throw new Error('dsh-switch-preset: ui runtime not initialized')
  return RUNTIME
}

/** 弹层遮罩（点空白关闭）。 */
function Backdrop({ onClose }: { onClose: () => void }): unknown {
  const { React } = getRuntime()
  return React.createElement('div', {
    onClick: onClose,
    style: { position: 'fixed', inset: 0, zIndex: 90 },
  })
}

/** 模式选择器（composer 工具行按钮 + 弹层）。 */
function ModePickerButton(props: { sessionId?: string }): unknown {
  const { React, picker } = getRuntime()
  const { useState } = React
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)
  const [rows, setRows] = useState<readonly PresetRow[] | null>(null)
  const [modeSelection, setModeSelection] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    try {
      const roster = await picker.fetchPresets(ctrl.signal)
      setRows(roster.presets)
      setModeSelection(roster.modeSelectionEnabled)
    } catch (e) {
      setError(e instanceof Error && e.name === 'AbortError'
        ? '加载模式列表超时，请重试'
        : `加载模式列表失败：${e instanceof Error ? e.message : String(e)}`)
      setRows(null)
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }

  const toggle = (ev: { currentTarget: { getBoundingClientRect(): DOMRect } }): void => {
    if (open) {
      setOpen(false)
      return
    }
    const rect = ev.currentTarget.getBoundingClientRect()
    setAnchor({ left: rect.left, top: rect.bottom + 6 })
    setOpen(true)
    setNotice(null)
    void load()
  }

  const select = async (id: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await picker.executeSwitch(props.sessionId ?? '', id)
      setNotice(`已执行切换到 ${id}`)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const h = React.createElement
  const children: unknown[] = []

  children.push(h('button', {
    key: 'btn',
    title: '切换会话模式（Agent preset）',
    disabled: busy,
    onClick: toggle,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      borderRadius: 6,
      border: `1px solid ${THEME.border}`,
      background: THEME.subtleFill,
      color: THEME.labelPrimary,
      cursor: 'pointer',
      fontSize: 14,
      opacity: busy ? 0.6 : 1,
    },
  }, '🔄'))

  if (notice) {
    children.push(h('span', {
      key: 'notice',
      style: { marginLeft: 6, fontSize: 12, color: THEME.labelSecondary },
    }, notice))
  }

  if (open && anchor) {
    const panel: unknown[] = []
    if (loading) panel.push(h('div', { key: 'loading', style: { padding: 8, color: THEME.labelSecondary } }, '加载模式列表…'))
    if (error) panel.push(h('div', { key: 'error', style: { padding: 8, color: THEME.danger, fontSize: 12 } }, error))
    if (!loading && rows && rows.length === 0) {
      panel.push(h('div', { key: 'empty', style: { padding: 8, color: THEME.labelSecondary } }, '没有可用模式（请检查 agent preset 配置）'))
    }
    if (!modeSelection) {
      panel.push(h('div', { key: 'modesel-off', style: { padding: '6px 8px', color: THEME.labelSecondary, fontSize: 12 } },
        '部署已关闭「模式选择」：新会话固定用默认模式，切换只对当前会话生效。'))
    }
    if (!loading && rows) {
      for (const row of rows) {
        const disabled = row.broken || busy
        const title = row.name && row.name !== row.id
          ? `${row.name}（${row.id}）`
          : row.id
        panel.push(h('button', {
          key: row.id,
          disabled,
          onClick: () => void select(row.id),
          style: {
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '8px 10px',
            border: 'none',
            background: 'transparent',
            color: THEME.labelPrimary,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            fontSize: 13,
            lineHeight: 1.4,
          },
        },
          h('span', { style: { fontWeight: 600 } },
            title,
            row.broken ? ' — 已损坏' : '',
            row.isDefault ? ' — 默认' : ''),
          row.description
            ? h('div', { style: { color: THEME.labelSecondary, fontSize: 12, marginTop: 2 } }, row.description)
            : null,
        ))
      }
    }
    panel.push(h('div', {
      key: 'footer',
      style: {
        padding: '6px 10px',
        borderTop: `1px solid ${THEME.border}`,
        color: THEME.labelSecondary,
        fontSize: 11,
      },
    }, '提示：会话未开始时可就地切换；已开始时会改为设定默认模式'))

    children.push(
      h(Backdrop, { key: 'bd', onClose: () => setOpen(false) }),
      h('div', {
        key: 'panel',
        style: {
          position: 'fixed',
          left: Math.max(8, anchor.left),
          top: anchor.top,
          zIndex: 100,
          minWidth: 260,
          maxWidth: 340,
          maxHeight: 340,
          overflowY: 'auto',
          background: THEME.surface,
          border: `1px solid ${THEME.border}`,
          borderRadius: 8,
          boxShadow: THEME.shadow,
          padding: 4,
        },
      }, ...panel),
    )
  }

  return h('div', { style: { display: 'inline-flex', alignItems: 'center', marginRight: 4 } }, ...children)
}

/** 装配 UI 模块（entry.ts 调用一次）。 */
export function makeUi(options: MakeUiOptions): { ModePickerButton: unknown } {
  RUNTIME = options
  return { ModePickerButton }
}