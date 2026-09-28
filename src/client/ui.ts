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
  /**
   * 执行 `/router-preset <原话>`（v0.5.0 概率路由），返回命令结果文本；
   * 客户端据此解析接力标记并把原话作为普通用户消息补发。
   */
  routeByUtterance: (sessionId: string, utterance: string) => Promise<string | undefined>
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
function ModePickerButton(props: {
  sessionId?: string
  /**
   * 会话 standard props 的 `useInput` 选择器钩子（框架对 session 作用域插槽自动注入）：
   * 用于读取**当前草稿**——"按内容自动判定"就是把草稿当作要说的原话。
   */
  useInput?: (selector: (state: { readonly draft: string }) => string) => string
}): unknown {
  const { React, picker, Menu } = getRuntime()
  const { useState } = React
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<readonly PresetRow[] | null>(null)
  const [modeSelection, setModeSelection] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [routeDetail, setRouteDetail] = useState<string | null>(null)

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

  /**
   * v0.5.0 概率路由（方案 B）：
   * 1. 取当前草稿作为「用户原话」（这就是用户要说给 agent 的内容）；
   * 2. 执行 `/router-preset <原话>`——Host 做概率判定，达阈值则切换；
   * 3. 结果里若带接力标记 → 把原话写回输入框并 submit（等价用户按了发送），
   *    使原话在**切换后的模式**下继续交互。
   *
   * 失败语义：拿不到草稿/通道时明确提示，不静默（用户绝不会以为发出去了）。
   */
  /**
   * v0.5.0 概率路由：取当前草稿作为「用户原话」→ 执行 `/router-preset <原话>`。
   *
   * 三步（判定/切换/投递）全部在 Host 侧完成——投递是 sessionController.prompt，
   * 因此**不需要**客户端接力（早期设想的客户端 setDraft+submit 方案已被实测推翻：
   * 客户端拿不到用户键入命令的结果，详见 shared/contracts.ts 的 deliverUtterance 注释）。
   * 客户端这里只负责：取草稿 + 展示 Host 返回的判定与投递实况。
   */
  const routeByDraft = async (): Promise<void> => {
    const utterance = (props.useInput ? props.useInput(s => s.draft) : '').trim()
    if (utterance === '') {
      setError('输入框是空的：请先写下你要说的话，再点「按内容自动判定模式」')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const text = await picker.routeByUtterance(props.sessionId ?? '', utterance)
      if (text === undefined) {
        setNotice('路由判定已执行（未返回文本结果）')
        setOpen(false)
        return
      }
      setRouteDetail(text)
      // 回显实况：以 Host 文本里的投递结论为准（未投递时必须让用户看到要手动重发）
      if (text.includes('未投递')) {
        setNotice('已判定并切换，但原话未投递——请手动重新发送')
      } else if (text.includes('无法判定')) {
        setNotice('无法判定：当前模式没有可供判别的特征')
      } else if (text.includes('已切换')) {
        setNotice('已按概率切换模式，原话已作为该模式下的输入继续')
      } else {
        setNotice('判定完成（未达阈值，未切换）')
      }
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
  // v0.5.0：置顶"按内容自动判定"——把输入框里的原话交给概率路由，达阈值自动切换并接力继续
  const draftText = (props.useInput ? props.useInput(s => s.draft) : '').trim()
  items.push({
    id: '$route',
    disabled: busy,
    label: h('div', { style: { whiteSpace: 'normal', maxWidth: 300, padding: '4px 2px' } },
      h('div', { style: { fontWeight: 600 } }, '⚡ 按内容自动判定模式'),
      h('div', { style: { color: THEME.labelSecondary, fontSize: 12, marginTop: 3 } },
        draftText === ''
          ? '（先在输入框写下你的内容，再点这里）'
          : `判定后用「${draftText.length > 40 ? `${draftText.slice(0, 40)}…` : draftText}」在该模式下继续`)),
  })
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
    onSelect: (id: string) => {
      if (id === '$retry') return load()
      if (id === '$route') return routeByDraft()
      return select(id)
    },
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

  // 路由判定明细（未达阈值时会展示概率分布，说明"为什么没切"）
  if (routeDetail) {
    children.push(h('div', {
      key: 'routeDetail',
      style: {
        marginLeft: 6, padding: '6px 8px', maxWidth: 420, fontSize: 12, whiteSpace: 'pre-wrap',
        color: THEME.labelSecondary, background: THEME.subtleFill,
        border: `1px solid ${THEME.border}`, borderRadius: 6,
      },
      title: '路由判定明细（点「⇄」可重新判定）',
    }, routeDetail))
  }

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
