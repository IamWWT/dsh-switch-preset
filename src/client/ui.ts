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
  Menu: unknown
}

const THEME = {
  subtleFill: 'var(--dsw-alias-interactive-bg-hover)',
  labelPrimary: 'var(--dsw-alias-label-primary)',
  labelSecondary: 'var(--dsw-alias-label-secondary)',
  border: 'var(--dsw-alias-border-l2)',
  danger: 'var(--dsw-alias-state-error-primary)',
} as const

let RUNTIME: MakeUiOptions | null = null
function getRuntime(): MakeUiOptions {
  if (!RUNTIME) throw new Error('dsh-switch-preset: ui runtime not initialized')
  return RUNTIME
}

/** 模式选择器（composer 工具行按钮 + 弹层）。 */
function ModePickerButton(props: { sessionId?: string }): unknown {
  const { React, picker, Menu } = getRuntime()
  const { useState } = React
  const [open, setOpen] = useState(false)
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

  const toggle = (): void => {
    if (open) {
      setOpen(false)
      return
    }
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
  const anchor = h('button', {
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
    'aria-label': '切换会话模式',
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    type: 'button',
  }, '⇄')

  const items: { id: string; label: unknown; disabled?: boolean }[] = []
  if (loading) items.push({ id: '$loading', label: '加载模式列表…', disabled: true })
  if (error) items.push({ id: '$error', label: error, disabled: true }, { id: '$retry', label: '重试' })
  if (!loading && rows?.length === 0) items.push({ id: '$empty', label: '没有可用模式', disabled: true })
  if (!loading && rows) for (const row of rows) {
    const title = row.name && row.name !== row.id ? row.name + '（' + row.id + '）' : row.id
    items.push({ id: row.id, disabled: !!row.broken || busy, label: h('div', {
      style: { whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: 300, padding: '4px 2px' },
    }, h('div', { style: { fontWeight: 600 } }, title, row.isDefault ? ' · 默认' : '', row.broken ? ' · 已损坏' : ''),
    row.description ? h('div', { style: { color: THEME.labelSecondary, fontSize: 12, marginTop: 3 } }, row.description) : null) })
  }
  const children: unknown[] = [h(Menu, {
    key: 'menu', anchor, items, open, portal: true, autoFocus: true, side: 'top', align: 'end',
    listClassName: 'dshPresetMenu',
    onClose: () => setOpen(false),
    onSelect: (id: string) => id === '$retry' ? load() : select(id),
    footer: h('div', { style: { padding: '8px 10px', maxWidth: 300, color: THEME.labelSecondary, fontSize: 12 } },
      !modeSelection ? '部署已关闭新会话模式选择；此处仍可切换当前会话。' : '切换当前会话模式；已有历史会保留。'),
  }), h('style', { key: 'style' }, `
    .dshPresetMenu.dshPresetMenu {
      background: var(--dsw-alias-bg-layer-1);
      border: 1px solid var(--dsw-alias-border-l2);
      min-width: min(300px, calc(100vw - 24px));
      max-width: min(360px, calc(100vw - 24px));
    }
  `)]

  if (notice) {
    children.push(h('span', {
      key: 'notice',
      style: { marginLeft: 6, fontSize: 12, color: THEME.labelSecondary },
    }, notice))
  }

  return h('div', { style: { display: 'inline-flex', alignItems: 'center', marginRight: 4 } }, ...children)
}

/** 装配 UI 模块（entry.ts 调用一次）。 */
export function makeUi(options: MakeUiOptions): { ModePickerButton: unknown } {
  RUNTIME = options
  return { ModePickerButton }
}
