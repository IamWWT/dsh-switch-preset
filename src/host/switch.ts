/**
 * host/switch.ts — /switch-preset 与 /list-preset 的核心逻辑（纯函数域，不触碰 cordis ctx）
 *
 * 设计：所有外部能力（agentPresets / 默认模式写入 / 当前 preset 读取）以 SwitchDeps
 * 接口注入，本模块可脱离 DSH 运行时单测（铁律 #3 契约先行）。真实服务组装在
 * host/command.ts 完成。
 *
 * v1.1 行为矩阵（2026-09-17 用户反馈：留在当前会话，单一真源）：
 *   - 无参 /switch-preset  → 等同 /list-preset（列出 id + 中文名 + 中文描述）
 *   - 带参，会话未开始      → agentPresets.select 就地换模式（留在当前会话）
 *   - 带参，会话已开始      → 框架锁死 preset → 写默认模式（之后新建会话生效）+ 明示
 *   - 目标不可用/格式非法    → error，不产生任何副作用
 *   - 幂等：目标 == 当前模式 → 成功文案说明已是该模式
 */
import {
  AGENT_PRESET_REGISTRY_ID,
  COMMAND_NAME,
  KEY_SELECTED_DEFAULT,
  LIST_COMMAND_NAME,
  PRESET_ID_PATTERN,
  type AgentLike,
  type PresetRoster,
  type PresetRow,
  type SwitchDeps,
  type SwitchResult,
} from '../shared/contracts.ts'

/**
 * 读 roster + 策略。
 * 0.1.7 的单一真源是 `remoteExportList()`：一次拿到 `{ presets, modeSelectionEnabled }`，
 * 且每行带 `isDefault`——不再需要自己从 `isDefault` 猜默认模式。
 */
async function readRoster(deps: SwitchDeps): Promise<PresetRoster> {
  return deps.agentPresets.remoteExportList()
}

/** 把 roster 行渲染成展示块（列表指令输出用；中文名与中文描述来自 preset.yml 的 name/description）。 */
export function renderPresetRow(row: PresetRow, currentId?: string, defaultId?: string): string {
  const label = row.name && row.name !== row.id ? `${row.name}（${row.id}）` : row.id
  const marks: string[] = []
  if (row.id === currentId) marks.push('当前会话')
  if (row.isDefault || row.id === defaultId) marks.push('默认')
  if (row.broken) marks.push(`已损坏，不可用：${row.broken}`)
  const suffix = marks.length > 0 ? `  ← ${marks.join(' / ')}` : ''
  const desc = row.description ? `\n      ${row.description}` : ''
  return `  - ${label}${suffix}${desc}`
}

/** 中文名优先的简短称谓（成功文案用）。 */
function labelOf(row: PresetRow): string {
  return row.name && row.name !== row.id ? `${row.name}（${row.id}）` : row.id
}

/** 列表渲染：id + 中文名 + 中文描述 + 当前/默认标注 + 模式选择开关状态 + 用法提示。 */
async function renderList(agent: AgentLike, deps: SwitchDeps): Promise<SwitchResult> {
  let roster: PresetRoster
  try {
    roster = await readRoster(deps)
  } catch (error) {
    return {
      kind: 'error',
      text: `读取模式清单失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }
  const rows = roster.presets
  const current = await deps.currentPreset?.(agent)
  const defaultRow = rows.find(r => r.isDefault)
  const defaultId = defaultRow?.id

  const usable = rows.filter(r => !r.broken)
  const broken = rows.filter(r => r.broken)
  const lines: string[] = []
  lines.push(`当前会话模式：${current ?? '（未识别）'}`)
  lines.push(`默认模式：${defaultId ?? '（未声明）'}`)
  if (!roster.modeSelectionEnabled) {
    lines.push('模式选择：已关闭（新会话固定用部署默认模式；/switch-preset 只能改当前会话）')
  }
  lines.push('')
  if (usable.length === 0) {
    lines.push('可用模式：无（请检查 agent preset 配置）')
  } else {
    lines.push(`可用模式（${usable.length}）—— 用于 /${COMMAND_NAME} <id>：`)
    for (const row of usable) lines.push(renderPresetRow(row, current, defaultId))
  }
  if (broken.length > 0) {
    lines.push('')
    lines.push(`不可用（${broken.length}）：`)
    for (const row of broken) lines.push(renderPresetRow(row, current, defaultId))
  }
  lines.push('')
  lines.push(`用法：/${COMMAND_NAME} <id> 切换；/${LIST_COMMAND_NAME} 查看本清单。`)
  return { kind: 'success', text: lines.join('\n') }
}

/** 判定错误是否为「会话已开始、preset 锁定」。 */
function isPresetLocked(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: string } | null)?.code ?? ''
  return /agent-preset\/locked/i.test(code) || /already started|preset is fixed|locked/i.test(msg)
}

/**
 * 命令统一入口（/switch-preset）。
 * @param agent - commands handler 传入的当前 agent（决定"就地换"能否生效）。
 * @param rawInput - 命令原始输入（presetId 或空/空白 → 等同于列表）。
 * @param deps - 注入的真实服务适配。
 */
export async function switchPreset(
  agent: AgentLike,
  rawInput: string,
  deps: SwitchDeps,
): Promise<SwitchResult> {
  const presetId = rawInput.trim()
  if (presetId === '') return renderList(agent, deps)

  // 1. 格式与存在性校验（副作用为零）
  if (!PRESET_ID_PATTERN.test(presetId)) {
    return {
      kind: 'error',
      text: `模式 id 格式不正确：${presetId}（应为小写字母/数字/中划线）。用 /${LIST_COMMAND_NAME} 查看可用 id。`,
    }
  }
  let roster: PresetRoster
  try {
    roster = await readRoster(deps)
  } catch (error) {
    return {
      kind: 'error',
      text: `读取模式清单失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }
  const rows = roster.presets
  const target = rows.find(r => r.id === presetId)
  if (!target || target.broken) {
    return {
      kind: 'error',
      text: `模式 ${presetId} 不可用（不存在或已损坏）。用 /${LIST_COMMAND_NAME} 查看可用模式。`,
    }
  }

  const current = await deps.currentPreset?.(agent)

  // 2. 优先走框架正规路径（空会话可用）；框架锁死时进入 3/4 的强制切换
  try {
    await deps.agentPresets.select(agent, presetId)
    return {
      kind: 'success',
      text: `已把当前会话模式切换为 ${labelOf(target)}，就地生效（留在当前会话）。`,
    }
  } catch (error) {
    if (!isPresetLocked(error)) {
      return {
        kind: 'error',
        text: `切换失败：${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  // 3. 已开始的会话：用户显式要求「当前会话换模式」——走强制重装配
  //    （agentPresets.recompose 无锁定检查；随后写入 agent-preset/selected 事件
  //    保持会话投影/header 一致，重启后仍按新模式重建）
  //    注意：换 preset 会更换当前会话的工具集/prompt 组成，历史中旧模式独有工具
  //    的调用记录可能无法在新模式解析——这是 DSH 框架默认禁止换 preset 的原因，
  //    此处按用户明确要求放行。
  if (current === presetId) {
    return {
      kind: 'success',
      text: `当前会话已经是 ${labelOf(target)}，无需切换。`,
    }
  }
  if (deps.agentPresets.recompose && agent.ctx !== undefined && typeof agent.session.append === 'function') {
    try {
      const applied = await deps.agentPresets.recompose(agent.ctx, presetId)
      await agent.session.append('agent-preset/selected', { agentPreset: applied.id ?? presetId })
      return {
        kind: 'success',
        text: `已把当前会话（含既有历史）就地切换为 ${labelOf({ ...target, id: applied.id ?? presetId })}，立即生效。`
          + '\n提示：模式切换会更换本会话的工具集，历史中旧模式独有的工具调用可能无法在新模式下解析。',
      }
    } catch (error) {
      return {
        kind: 'error',
        text: `强制切换当前会话失败：${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  // 4. 强制切换不可用（宿主未提供 recompose / agent 形状不完整）→ 降级为写默认模式。
  //    0.1.7 语义：默认模式 = 条目 agent-preset-registry 的 selectedDefault，
  //    且注册表策略是 `modeSelectionEnabled ? selectedDefault ?? default : default`
  //    —— 开关关闭时写它**不生效**，此时必须如实失败，不能假报成功。
  if (!roster.modeSelectionEnabled) {
    return {
      kind: 'error',
      text: `当前会话已开始，本版本 DSH 不允许就地换模式；且部署已关闭「模式选择」`
        + `（${AGENT_PRESET_REGISTRY_ID}.modeSelectionEnabled=false），写默认模式不会生效。`
        + `\n如需换模式：新建会话，或先在设置里打开模式选择。`,
    }
  }
  if (!deps.writeDefaultPreset) {
    return {
      kind: 'error',
      text: `当前会话已开始，DSH 限制 preset 固定；且设置服务不可用，无法改默认模式`
        + `（${AGENT_PRESET_REGISTRY_ID}.${KEY_SELECTED_DEFAULT}）。`,
    }
  }
  try {
    await deps.writeDefaultPreset(presetId)
  } catch (error) {
    return {
      kind: 'error',
      text: `当前会话 preset 已锁定（DSH 限制）；写默认模式失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }
  return {
    kind: 'success',
    text: `当前会话已开始，DSH 限制 preset 固定（当前仍为 ${current ?? '未识别'}）；当前宿主不支持强制切换，`
      + `已把默认模式设为 ${labelOf(target)}——对之后新建的会话生效。`,
  }
}

/** /list-preset 入口：与无参 /switch-preset 同源。 */
export async function listPresets(agent: AgentLike, deps: SwitchDeps): Promise<SwitchResult> {
  return renderList(agent, deps)
}