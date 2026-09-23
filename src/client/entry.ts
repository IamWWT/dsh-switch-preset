/**
 * client/entry.ts — dsh-switch-preset Client 入口（浏览器侧，DSH ModuleLoader 握手）
 *
 * v1.1（2026-09-17 用户反馈）：不再自动跳转（切换留在当前会话）、不再有设置卡
 * （inheritHistory 已废弃）。唯一注册点：
 *   `conversation.input.right` —— 模式选择器按钮（弹层列中文名/描述，点选经
 *   `remote.commands.execute('/switch-preset <id>')` 复用 Host 命令逻辑）。
 *
 * sessionId 经注册时 inject 工厂的位置参数取得（framework-resolved），不是 standard prop。
 */
import { COMMAND_NAME } from '../shared/contracts.ts'
import { makeUi, type PickerDeps } from './ui.ts'

declare global {
  interface Window {
    __ModuleLoader__?: { load: (reg: { id: string; factory: (require: (m: string) => unknown) => unknown }) => void }
  }
}

type RequireFn = (m: string) => unknown

/** 客户端 Remote 返回形状（对齐 dsh-api-remotes RpcResult）。 */
type RpcResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code?: string; readonly message: string } }

function unwrap<T>(result: RpcResult<T>): T {
  if (result.ok) return result.value
  throw new Error(result.error.message || result.error.code || 'remote call failed')
}

interface RemoteCommands {
  execute(sessionId: string, line: string, attachments?: readonly unknown[]): Promise<RpcResult<unknown>>
}

interface RemoteAgentPresets {
  /** 0.1.7：`@Remote('list')` 返回 roster 对象（presets + modeSelectionEnabled），不再是裸数组。 */
  list(): Promise<RpcResult<{
    readonly presets: readonly {
      readonly id: string
      readonly name?: string
      readonly description?: string
      readonly broken?: string
      readonly isDefault?: boolean
    }[]
    readonly modeSelectionEnabled: boolean
  }>>
}

interface SlotsLike {
  inject(key: string, f: () => unknown): void
  register(spec: object, comp: unknown): unknown
}

interface ClientCtx {
  get: <K extends string>(key: K) => unknown
}

/** 有限超时的 promise 包装（UI 层绝不无限转圈；不能取消的远程调用由 UI 放弃等待）。 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}超时（${Math.round(ms / 1000)}s）`)), ms)
    p.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

export function factory(require: RequireFn): unknown {
  const React = require('react') as Parameters<typeof makeUi>[0]['React']

  return {
    name: 'dsh-switch-preset',
    inject: ['slots', 'remote.commands', 'remote.agentPresets'],
    apply(ctx: ClientCtx): void {
      const get = ctx.get.bind(ctx)
      const slots = get('slots') as SlotsLike | undefined
      const remoteCommands = get('remote.commands') as RemoteCommands | undefined
      const remoteAgentPresets = get('remote.agentPresets') as RemoteAgentPresets | undefined
      if (!slots || !remoteCommands || !remoteAgentPresets) {
        console.warn('[dsh-switch-preset] 模式选择器未注册：缺少 slots / remote.commands / remote.agentPresets 服务')
        return
      }

      const picker: PickerDeps = {
        fetchPresets: async (signal) => {
          void signal // list() 签名暂不支持 signal；超时由 withTimeout 兜底
          return unwrap(await withTimeout(remoteAgentPresets.list(), 8000, '加载模式列表'))
        },
        executeSwitch: async (sessionId, presetId) => {
          const line = `/${COMMAND_NAME} ${presetId}`
          unwrap(await withTimeout(remoteCommands.execute(sessionId, line, []), 10000, '执行切换'))
        },
      }

      const ui = makeUi({ React, picker })
      slots.inject('conversation.input.right', () =>
        slots.register(
          {
            name: 'conversation.input.right',
            id: 'dsh-switch-preset',
            order: 10,
            inject: (sessionId: string) => ({ sessionId }),
          },
          ui.ModePickerButton as never,
        ))
    },
  }
}

window.__ModuleLoader__?.load({ id: 'dsh-switch-preset', factory })