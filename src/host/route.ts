/**
 * host/route.ts — `/router-preset <用户原话>` 的决策与执行（纯逻辑域，不触碰 cordis ctx）
 *
 * 用户需求（2026-09-28 原话）：「如果不给答案可以给出判定某个模式命中的概率，概率第一高的就是要切换的
 * 类似 jev 模型」+「就是落到 /router-preset xxx 这个指令里面。等于是这条指令触发 preset 概率判定 +
 * switch preset 操作 + 用户原本内容在切换后的 preset 模式下的后续输入 agent 交互」。
 *
 * 三步流水（全部在本模块编排）：
 *   ① 概率判定：`ModeScorer`（可插拔；当前本地确定性打分，将来可换 JEV 类模型）
 *   ② 切换：**复用** `switchPreset()`（select → recompose → 写默认四级降级，单一真源）
 *   ③ 投递：把原话作为该会话的后续输入交给 agent（`SwitchDeps.deliverUtterance`，
 *      Host 侧走 core 服务 sessionController.prompt）
 *
 * 为什么③在 Host 侧（2026-09-28 实测，取代最初的"客户端接力"设想）：
 *   上游命令 handler 明确"不把命令发给模型"，`CommandResult` 只有 `{kind,text,sourceEventSeq}`；
 *   而客户端没有任何**公开**钩子能观察"用户键入的命令"的结果
 *   （`conversation.composer.bar` 的 `hooks.notices` 是 package-private，且该插槽为 single 已被占用）。
 *   因此客户端接力只能覆盖"插件自己发起的调用"，覆盖不了用户直接键入 `/router-preset xxx` 的主路径；
 *   投递必须在 Host 侧完成，才能让两种触发方式行为一致。
 *
 * 失败语义（铁律 #8 显式失败）：判定达阈值但**切换失败**时绝不投递（避免在原模式下误跑原话）；
 * 切换成功但**投递失败/通道不可用**时如实告知"未投递"，不假报成功。
 */
import {
  formatProbability,
  type ModeScorer,
  type ScoreBoard,
} from './router.ts'
import {
  COMMAND_NAME,
  LIST_COMMAND_NAME,
  type AgentLike,
  type PresetRoster,
  type SwitchDeps,
  type SwitchResult,
} from '../shared/contracts.ts'
import { switchPreset } from './switch.ts'

/** 默认阈值（用户 2026-09-28 选定 0.6）：低于它只提示、不切换。 */
export const DEFAULT_ROUTE_THRESHOLD = 0.6

/** 渲染概率分布（未达阈值时的主体输出）。 */
function renderBoard(board: ScoreBoard, utterance: string): string {
  const top = board.top
  if (!top) return '没有可用于判定的模式（模式清单为空或全部损坏）。用 /list-preset 检查模式配置。'
  const lines: string[] = []
  lines.push(`路由判定（阈值 ${formatProbability(board.threshold)}）`)
  lines.push(`输入：${utterance.length > 80 ? `${utterance.slice(0, 80)}…` : utterance}`)
  lines.push('')
  lines.push('模式命中概率：')
  for (const score of board.scores.slice(0, 6)) {
    const mark = score.id === top.id ? '★' : ' '
    const hits = score.hits.length > 0 ? `　命中：${score.hits.slice(0, 6).join('、')}` : ''
    lines.push(` ${mark} ${score.label}　${formatProbability(score.probability)}${hits}`)
  }
  return lines.join('\n')
}

/**
 * `/router-preset` 命令入口。
 *
 * @param agent - 当前 agent（切换目标）
 * @param rawInput - 用户原话（命令名之后的全部文本）
 * @param deps - 切换依赖（与 /switch-preset 同一份）
 * @param scorer - 概率引擎（默认本地；将来 JEV 模型实现同一接口即可替换）
 * @param threshold - 阈值（默认 0.6）
 */
export async function routePreset(
  agent: AgentLike,
  rawInput: string,
  deps: SwitchDeps,
  scorer: ModeScorer,
  threshold: number = DEFAULT_ROUTE_THRESHOLD,
): Promise<SwitchResult> {
  const utterance = rawInput.trim()

  // 无原话 → 退化为清单（与 /switch-preset 无参一致，不猜）
  if (utterance === '') {
    return {
      kind: 'error',
      text: `用法：/router-preset <你的原话>——系统按概率判定该切哪个模式，达阈值自动切换，`
        + `并把你的原话作为切换后模式下的输入继续。\n先看有哪些模式：/${LIST_COMMAND_NAME}`,
    }
  }

  // 1. 读 roster（模式清单唯一真源：id/name/description 全部来自运行时）
  let roster: PresetRoster
  try {
    roster = await deps.agentPresets.remoteExportList()
  } catch (error) {
    return {
      kind: 'error',
      text: `读取模式清单失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }

  // 2. 只对"可用模式"打分（损坏项不参与，避免切到坏模式）
  const candidates = roster.presets
    .filter(row => !row.broken)
    .map(row => ({ id: row.id, name: row.name, description: row.description }))

  if (candidates.length === 0) {
    return {
      kind: 'error',
      text: '没有可用模式（清单为空或全部损坏）。请检查 agent preset 配置后重试。',
    }
  }

  // 3. 概率判定（引擎可插拔：本地确定性打分 / 将来的 JEV 模型）
  const board = scorer.score(candidates, utterance, threshold)
  const header = `路由判定（引擎 ${scorer.engine}｜阈值 ${formatProbability(threshold)}）`

  // 4. 未达阈值 → 只提示不切换（用户 2026-09-28 决策），不出接力标记
  const top = board.top
  if (!board.passesThreshold || !top) {
    // 4a. 无判别力（全部并列）：不得给出"冠军"推荐（那只是排序副产品），如实说无法判定。
    //     现场依据（2026-09-28 3084 验收）：roster 为宿主内置模式时全为均匀先验。
    if (board.undetermined) {
      const names = board.scores.map(s => s.label).slice(0, 8).join('、')
      return {
        kind: 'success',
        text: [
          header,
          renderBoard(board, utterance).split('\n').slice(1).join('\n'),
          '',
          '→ **无法判定**：这些模式当前没有可用于判别的特征'
            + `（全部并列 ${formatProbability(top?.probability ?? 0)}），不做切换，也不推荐具体模式。`,
          `   原因通常是：当前 profile 只有宿主内置模式（${names}），而它们没有足够描述供打分。`,
          `   请手动选择：/${COMMAND_NAME} <id>（用 /${LIST_COMMAND_NAME} 查看清单）。`,
        ].join('\n'),
      }
    }
    if (!top) {
      return { kind: 'error', text: '没有可用模式用于判定，请用 /list-preset 检查模式配置。' }
    }
    return {
      kind: 'success',
      text: [
        header,
        renderBoard(board, utterance).split('\n').slice(1).join('\n'),
        '',
        `→ 最高概率 ${formatProbability(top.probability)} < 阈值 ${formatProbability(threshold)}，`
          + '**未自动切换**（避免低置信度切错模式）。',
        `   如确认切到该模式：/${COMMAND_NAME} ${top.id}，然后重新发送你的内容。`,
      ].join('\n'),
    }
  }

  // 5. 达阈值 → 复用 switchPreset（切换语义单一真源），再按切换结果决定是否接力
  const switched = await switchPreset(agent, board.top.id, deps)
  if (switched.kind === 'error') {
    return {
      kind: 'error',
      text: [
        header,
        `最高概率 ${formatProbability(board.top.probability)} ≥ 阈值，判定应切到 ${board.top.label}，`
          + '但切换失败（未接力发送原话，避免在原模式下误跑）：',
        switched.text,
      ].join('\n'),
    }
  }

  // 6. 切换成功 → ③ 投递原话（Host 侧），并按投递实况回显
  const head = [
    header,
    renderBoard(board, utterance).split('\n').slice(1).join('\n'),
    '',
    `→ 最高概率 ${formatProbability(board.top.probability)} ≥ 阈值，已切换：`,
    switched.text,
  ]

  if (!deps.deliverUtterance) {
    return {
      kind: 'success',
      text: [
        ...head,
        '',
        '⚠️ **未投递你的原话**：当前 profile 没有可用的会话投递通道（sessionController 不可用）。',
        `   已切换模式，请**手动重新发送**你的内容（会在「${board.top.label}」下执行）。`,
      ].join('\n'),
    }
  }

  let delivery
  try {
    delivery = await deps.deliverUtterance(agent, utterance)
  } catch (error) {
    return {
      kind: 'success',
      text: [
        ...head,
        '',
        `⚠️ **未投递你的原话**：${error instanceof Error ? error.message : String(error)}`,
        '   已切换模式，请**手动重新发送**你的内容。',
      ].join('\n'),
    }
  }

  return {
    kind: 'success',
    text: [
      ...head,
      '',
      delivery.ok
        ? `接下来把你的原话作为「${board.top.label}」下的输入继续：${delivery.message}`
        : `⚠️ **未投递你的原话**：${delivery.message}\n   已切换模式，请**手动重新发送**你的内容。`,
    ].join('\n'),
  }
}
