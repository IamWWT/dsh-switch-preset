/**
 * host/router.ts — `/router-preset <用户原话>` 的模式概率判定（纯函数域，不触碰 cordis ctx）
 *
 * 用户需求（2026-09-28 原话）：「如果不给答案可以给出判定某个模式命中的概率，概率第一高的就是要切换的
 * 类似 jev 模型」+「落到 /router-preset xxx 这个指令里面：这条指令触发 preset 概率判定 + switch preset
 * 操作 + 用户原本内容在切换后的 preset 模式下的后续输入 agent 交互」。
 *
 * 设计（契约先行，铁律 #3）：
 *   1. **概率引擎可插拔**：`ModeScorer` 是唯一打分接口。当前实现是本地确定性打分
 *      （`LocalModeScorer`，零依赖、可单测、离线可用）；将来接入 JEV 模型时，只需提供
 *      另一个实现（输入同一份 `Roster` + 用户原话，输出同一份 `ScoreBoard`），
 *      本模块与命令层**不需要改**——这是为「之后我们有 jev 模型了可以引入」预留的替换点。
 *   2. **概率分布归一化**：所有模式得分归一到 sum=1，输出 `ScoreBoard`（含冠军、边缘值）。
 *      无任何信号命中时退化为「均匀先验 × 描述关键词弱信号」，而不是给 0——避免
 *      "什么都没命中就乱切"，由阈值把关（见下）。
 *   3. **阈值决策与打分分离**：`decideRoute()` 只做决策（≥阈值 → switch；否则 → 只提示），
 *      阈值来自配置默认 0.6（用户 2026-09-28 选定）。决策是纯函数，可单测。
 *   4. **单一真源**：模式的 id/名称/描述一律来自运行时 roster（`agentPresets.remoteExportList()`），
 *      本模块**不含任何硬编码模式清单**——新增模式自动参与路由，不会漂移。
 */

/** 一个候选模式的打分输入（来自运行时 roster，非硬编码）。 */
export interface ModeCandidate {
  readonly id: string
  readonly name?: string
  readonly description?: string
}

/** 单模式得分（概率 + 命中的证据词，供回显解释"为什么是它"）。 */
export interface ModeScore {
  readonly id: string
  readonly label: string
  /** 归一化后的命中概率，[0,1]，全体 sum≈1。 */
  readonly probability: number
  /** 归一化前的原始加权分（调试/解释用）。 */
  readonly raw: number
  /** 触发该模式加权的关键词（回显给用户，避免"黑箱切换"）。 */
  readonly hits: readonly string[]
}

/** 一次判定的完整结果（冠军 + 全量分布 + 是否达阈值）。 */
export interface ScoreBoard {
  readonly scores: readonly ModeScore[]
  /** 概率最高的模式（scores 已按概率降序）。 */
  readonly top: ModeScore | undefined
  /** top.probability ≥ threshold。 */
  readonly passesThreshold: boolean
  /** 本次使用的阈值（回显用）。 */
  readonly threshold: number
  /**
   * 判定是否"无判别力"：全部候选概率相等（含并列第一）。
   *
   * 现场发现（2026-09-28，3084 验收）：当 roster 里是宿主内置模式
   * （standard/cordis/minimal/ptc，无本插件强特征、描述也很短）时，所有模式概率
   * 塌成均匀先验 1/n，"冠军"只是排序的副产品（字母序），此时**不能**把它当成
   * 判定结论展示或推荐——否则是在给用户一个任意答案。置 true 时上层必须如实说
   * "无法判定"，不给出冠军推荐。
   */
  readonly undetermined: boolean
}

/**
 * 概率打分引擎接口（**JEV 模型接入点**）。
 *
 * 当前实现：`LocalModeScorer`（确定性关键词/意图加权）。
 * 将来接 JEV：新实现只需按同一签名（candidates + utterance → ScoreBoard），
 * 在 `host/command.ts` 的组装处替换即可，命令层与客户端零改动。
 */
export interface ModeScorer {
  /** 引擎标识（回显在结果里，便于分辨"这次是谁判的"）。 */
  readonly engine: string
  /** 对一句话做全模式概率判定。 */
  score(candidates: readonly ModeCandidate[], utterance: string, threshold: number): ScoreBoard
}

/** 一个模式的关键词/意图特征表（描述关键词自动派生 + 少量人工强特征）。 */
interface ModeSignals {
  /** 强特征词（命中即高权重，区分度高的动作/交付物词汇）。 */
  readonly strong: readonly string[]
  /** 弱特征词（命中给低权重，用于兜底与并列打破）。 */
  readonly weak: readonly string[]
}

/**
 * 人工强特征表：**只放"动作/交付物"级的高区分度词**，不放通用词。
 *
 * 为什么不全部自动派生：preset 的 description 是"给模型看的说明"，含大量
 * 通用词（"Agent"、"通用"、"工作区"…），直接拿它做词表会让所有模式得分接近、
 * 概率塌成均匀分布，失去判别力。因此：
 *   - 强特征 = 本表的人工提炼（高区分度，权重 3）；
 *   - 弱特征 = 从 description/name 自动切词（权重 1，兜底）。
 * 新增模式若不在本表内，仍可通过自动切词参与打分（不会完全失声）。
 *
 * 单一真源说明：模式的 id/名称/描述仍来自运行时 roster；本表只是"打分词表"，
 * 属于本插件的算法资产，与被判定的模式清单解耦（模式增删不影响本表有效性）。
 */
const STRONG_SIGNALS: Record<string, readonly string[]> = {
  engineering: [
    '插件', '代码', '编译', '报错', 'bug', '重构', '打包', 'tgz', '构建', '测试',
    '路由', '接口', 'api', 'ts', 'typescript', 'python', 'java', 'go', '函数',
    '类型', 'lint', 'typecheck', '冒烟', '依赖', '版本', '提交', 'git', '部署',
    '卸载', '装到', '工程', 'npm', 'pnpm', 'esbuild', '加载', '崩溃', '异常',
  ],
  learning: [
    '学习', '讲解', '教我', '为什么', '原理', '概念', '区别', '搞懂', '理解',
    '复习', '记忆', '背诵', '出题', '考我', '例子', '入门', '怎么理解', '科普',
  ],
  office: [
    '报告', '文档', '周报', '日报', '总结', '方案', '汇报', 'ppt', '幻灯片',
    '公文', '纪要', '复盘', '审计', '写一份', '导出', 'word', 'docx', 'excel',
    '表格', '模板', '范式', '润色', '排版',
  ],
  research: [
    '调研', '研究', '查资料', '文献', '对比分析', '论证', '证据', '综述',
    '选题', '议题', '观点', '检索', '归纳', '论文', '综述', '资料',
  ],
  troubleshooting: [
    '排查', '故障', '报错原因', '定位问题', '为什么崩', '挂了', '无法访问',
    '超时', '日志', '指标', '告警', '根因', 'rca', '事故', '503', '500',
    '不可用', '性能', '慢', '内存', 'cpu', '磁盘', '链路',
  ],
  video: [
    '视频', '配音', '字幕', '剪辑', '分镜', '口播', '讲解视频', '演示视频',
    '教程视频', 'tts', '录制', '素材合成', '成片', '答辩视频', '汇报视频',
  ],
}

/** 通用停用词（不参与自动弱特征打分，避免所有模式同分）。 */
const STOP_WORDS = new Set([
  '的', '了', '和', '与', '及', '或', '是', '在', '我', '你', '他', '它', '这', '那',
  '一个', '一下', '请', '帮', '帮忙', '可以', '需要', '想要', '要', '把', '给', '对',
  'agent', 'dsh', '模式', '通用', '工作区', '使用', '支持', '适用', '所有', '以及',
  'the', 'a', 'an', 'to', 'of', 'for', 'and', 'or', 'is', 'are', 'with',
])

/** 强特征权重。 */
const WEIGHT_STRONG = 3
/** 弱特征（自动切词）权重。 */
const WEIGHT_WEAK = 1
/** 均匀先验的极小底分（保证任何输入下概率分布都有定义，不会除零）。 */
const PRIOR = 0.05

/** 把文本切成候选词（中文按 2-4 字滑窗 + 英文/数字按词），用于自动弱特征。 */
function tokenize(text: string): string[] {
  const lower = text.toLowerCase()
  const tokens: string[] = []
  // 英文/数字词
  for (const m of lower.matchAll(/[a-z][a-z0-9+#.-]{1,}/gu)) tokens.push(m[0])
  // 中文 2-4 字滑窗（中文无空格，滑窗是最省事且够用的近似切词）
  const cjkRuns = lower.match(/[\u4e00-\u9fa5]+/gu) ?? []
  for (const run of cjkRuns) {
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= run.length; i++) tokens.push(run.slice(i, i + n))
    }
  }
  return tokens
}

/** 从某个模式自己的 name/description 自动派生弱特征词集（去掉停用词与单字）。 */
function deriveWeakSignals(candidate: ModeCandidate): Set<string> {
  const text = `${candidate.name ?? ''} ${candidate.description ?? ''}`
  const set = new Set<string>()
  for (const token of tokenize(text)) {
    if (token.length < 2) continue
    if (STOP_WORDS.has(token)) continue
    set.add(token)
  }
  return set
}

/** 人类可读标签（中文名优先）。 */
function labelOf(candidate: ModeCandidate): string {
  return candidate.name && candidate.name !== candidate.id ? `${candidate.name}（${candidate.id}）` : candidate.id
}

/**
 * 本地确定性打分引擎（默认实现）。
 *
 * 算法：对每个候选模式，用「强特征表命中（权重 3）+ 该模式自身描述派生的弱特征命中（权重 1）」
 * 累加原始分；再叠加均匀先验 PRIOR 保证分布有定义；最后归一化为概率。
 * 命中词去重记录，供回显解释。
 */
export class LocalModeScorer implements ModeScorer {
  readonly engine = 'local-keyword-v1'

  score(candidates: readonly ModeCandidate[], utterance: string, threshold: number): ScoreBoard {
    const text = utterance.toLowerCase()
    const utteranceTokens = new Set(tokenize(utterance))

    const raw = candidates.map((candidate) => {
      const hits: string[] = []
      let score = PRIOR

      // 1. 强特征：直接对原文做子串命中（抗切词误差，中文短语更可靠）
      for (const signal of STRONG_SIGNALS[candidate.id] ?? []) {
        if (text.includes(signal)) {
          score += WEIGHT_STRONG
          hits.push(signal)
        }
      }

      // 2. 弱特征：该模式自身 name/description 派生词与用户原话的交集
      const weak = deriveWeakSignals(candidate)
      for (const token of utteranceTokens) {
        if (weak.has(token) && !hits.includes(token)) {
          score += WEIGHT_WEAK
          hits.push(token)
        }
      }

      return { candidate, score, hits }
    })

    const total = raw.reduce((sum, r) => sum + r.score, 0)
    const scores: ModeScore[] = raw
      .map(r => ({
        id: r.candidate.id,
        label: labelOf(r.candidate),
        probability: total > 0 ? r.score / total : 0,
        raw: r.score,
        hits: r.hits,
      }))
      // 概率降序；并列时按分数、再按 id 稳定排序（保证可复现，单测友好）
      .sort((a, b) => b.probability - a.probability || b.raw - a.raw || a.id.localeCompare(b.id))

    const top = scores[0]
    // 无判别力判定：所有模式概率相等（并列第一即代表没有任何模式"胜出"）。
    // 这不等于"概率低"，而是"这次输入里没有任何可区分模式的信号"，上层须如实说明。
    const first = scores[0]?.probability ?? 0
    const tied = scores.filter(s => s.probability === first).length
    const undetermined = scores.length > 1 && (tied === scores.length || tied > 1)
    return {
      scores,
      top,
      passesThreshold: top !== undefined && !undetermined && top.probability >= threshold,
      threshold,
      undetermined,
    }
  }
}

/** 默认引擎实例（命令层使用；替换 JEV 时改这一处或注入新实例）。 */
export const defaultScorer: ModeScorer = new LocalModeScorer()

/** 把概率渲染成百分比字符串（回显用，保留 1 位小数）。 */
export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

/**
 * 渲染概率分布回显（JEV 风格：给出全部分布 + 冠军 + 是否达阈值）。
 *
 * @param board - 打分结果
 * @param utterance - 用户原话（回显用了哪个输入做出判定）
 * @param action - 达阈值时的动作描述（如"已切换"），未达阈值传 undefined
 */
export function renderScoreBoard(
  board: ScoreBoard,
  utterance: string,
  action?: string,
): string {
  const lines: string[] = []
  const top = board.top
  if (!top) {
    return '没有可用于判定的模式（模式清单为空或全部损坏）。用 /list-preset 检查模式配置。'
  }
  lines.push(`路由判定（引擎 ${defaultScorer.engine}｜阈值 ${formatProbability(board.threshold)}）`)
  lines.push(`输入：${utterance.length > 80 ? `${utterance.slice(0, 80)}…` : utterance}`)
  lines.push('')
  lines.push('模式命中概率：')
  for (const score of board.scores.slice(0, 6)) {
    const mark = score.id === top.id ? '★' : ' '
    const hits = score.hits.length > 0 ? `　命中：${score.hits.slice(0, 6).join('、')}` : ''
    lines.push(` ${mark} ${score.label}　${formatProbability(score.probability)}${hits}`)
  }
  lines.push('')
  if (board.passesThreshold && action) {
    lines.push(`→ 最高概率 ${formatProbability(top.probability)} ≥ 阈值，${action}`)
  } else {
    lines.push(`→ 最高概率 ${formatProbability(top.probability)} < 阈值 ${formatProbability(board.threshold)}，`
      + `**未自动切换**（避免低置信度切错模式）。`)
    lines.push(`   如确认要切到 ${top.label}：/${'switch-preset'} ${top.id}`)
  }
  return lines.join('\n')
}
