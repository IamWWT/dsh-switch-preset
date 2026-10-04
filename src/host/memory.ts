/**
 * host/memory.ts — `/router-preset-memory` 的渐进式记忆加载（纯逻辑域，v0.6.0）
 *
 * 用户需求（2026-10-05 原话，见 docs/REQUIREMENTS.md v0.6.0）：
 * 「/router-preset-memory {用户原话} → 渐进式根据需求加载记忆：个人记忆、选择项目记忆、
 *   选择性会话记忆」——对应 dsh-kb 的 L1/L2/L3 读取层级协议（00-索引/README.md）。
 *
 * 设计约束（对齐插件铁律）：
 *   1. **不调用任何 LLM API**（铁律 #3）：本模块只做文件读取与文本拼接，
 *      结果经命令层的 deliverUtterance（sessionController.prompt）交给 DSH 自己的 agent 循环。
 *   2. **不依赖其他插件**（铁律 #2 禁插件互依）：kbRoot 解析按工作区约定
 *      （daily-workbench `host/kb.ts` 同范式）自实现，不 import 它——遵循
 *      config → DASH_KB_HOME → 模块位置推导 → profile 反推 → ~/dsh-kb 四层回退。
 *   3. **不硬编码机器路径**：一律经 node:os / node:path 解析；测试用临时目录造假 dsh-kb。
 *   4. **失败降级不阻塞**：知识库缺失/读取异常 → `{ok:false}` + 明确说明，命令照常切模式+投递原话。
 *   5. **限量渐进**（对齐 dsh-kb L0-L5 协议，防上下文爆炸）：
 *        L1 个人记忆：01-偏好/人物画像.md（档案区，≤100 行）
 *        L2 项目记忆：02-项目/*.md 按原话关键词匹配（≤2 张卡，各 ≤40 行）
 *        L3 会话记忆：04-每日/ 最近 3 天（各取事实/决策小节节选，各 ≤30 行）
 */
import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MemoryContextResult } from '../shared/contracts.ts'

/* ------------------------------------------------------------------ *
 * kbRoot 解析（与 daily-workbench 同范式；四层回退，无机器专属路径）
 * ------------------------------------------------------------------ */

/** volatile 包装对象的最小形状（`.volatile()` 字段的运行时形态）。 */
interface VolatileLike<T> {
  get: () => T
}

function isVolatileLike<T>(v: unknown): v is VolatileLike<T> {
  return typeof v === 'object' && v !== null && typeof (v as { get?: unknown }).get === 'function'
}

/** 读取 kbRoot 配置的**当前字符串值**（兼容 volatile 包装 / 普通字符串 / 缺失）。 */
export function readKbRoot(cfg: unknown): string {
  const raw = (cfg as { kbRoot?: unknown } | null | undefined)?.kbRoot
  if (isVolatileLike<unknown>(raw)) {
    const inner = raw.get()
    return typeof inner === 'string' ? inner : ''
  }
  return typeof raw === 'string' ? raw : ''
}

/** 本插件的包名（profile 依赖反查时用）。 */
const SELF_PACKAGE_NAME = 'dsh-switch-preset'

/** DSH home 候选：显式 DSH_HOME 优先，其次本机惯例（Windows .dsh / Ubuntu .dsh-dev）。 */
function dshHomeCandidates(): string[] {
  const out: string[] = []
  const env = process.env.DSH_HOME
  if (env && env.trim()) out.push(path.resolve(env.trim()))
  const defaultName = process.env.DSH_HOME_DIRNAME?.trim() || (process.platform === 'win32' ? '.dsh' : '.dsh-dev')
  out.push(path.join(os.homedir(), defaultName))
  return out
}

/**
 * 由 profile 的 package.json 中本插件的 `file:` 依赖（tgz 路径）反推管理根。
 * 安装态（profile node_modules）下「由模块位置推导」必然失败——
 * 而 profile 依赖 `file:<管理根>/dsh-plugins/<pkg>/<pkg>-<ver>.tgz` 记录真实来源链。
 */
function deriveKbRootFromProfile(): string | undefined {
  for (const dshHome of dshHomeCandidates()) {
    try {
      const pkgPath = path.join(dshHome, 'profiles', 'web', 'package.json')
      const raw = readFileSync(pkgPath, 'utf-8')
      const deps = (JSON.parse(raw) as { dependencies?: Record<string, unknown> }).dependencies ?? {}
      const spec = deps[SELF_PACKAGE_NAME]
      if (typeof spec !== 'string' || !spec.startsWith('file:')) continue
      const tgz = spec.slice('file:'.length)
      // <管理根>/dsh-plugins/<pkg>/<pkg>-<ver>.tgz → 上溯三级
      const root = path.resolve(path.dirname(tgz), '..', '..')
      if (existsSync(path.join(root, 'dsh-plugins'))) return path.join(root, 'data', 'dsh-kb')
    } catch {
      /* 该 home 不可用，继续下一个 */
    }
  }
  return undefined
}

/** 由本模块位置推导 `<管理根>/data/dsh-kb`（仅源码树态有效）。 */
function deriveKbRootFromModule(): string | undefined {
  try {
    let dir = path.dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 6; i += 1) {
      if (existsSync(path.join(dir, 'dsh-plugins'))) return path.join(dir, 'data', 'dsh-kb')
      const up = path.resolve(dir, '..')
      if (up === dir) break
      dir = up
    }
  } catch {
    /* 忽略：回退默认 */
  }
  return undefined
}

/** kbRoot 解析来源（回显时标注「记忆来自哪」）。 */
export type KbRootSource = 'config' | 'env' | 'derived' | 'fallback' | 'none'

export interface KbRootInfo {
  root: string
  source: KbRootSource
}

/**
 * 解析知识库根目录**并给出来源**（优先级与 daily-workbench 约定一致）：
 *   1. `kbRoot` 配置（插件页/ profile 层 config）
 *   2. `DASH_KB_HOME` 环境变量
 *   3. 本模块位置推导 `<DEEPSEEK_ROOT>/data/dsh-kb`（源码树态）
 *   4. profile 依赖反推（安装态）
 *   5. `~/dsh-kb` 历史兜底
 * 全部失败 → `{ root:'', source:'none' }`（调用方降级）。
 */
export function kbRootInfoOf(cfg: { kbRoot?: unknown } = {}): KbRootInfo {
  const configured = readKbRoot(cfg)
  if (configured.trim()) return { root: path.resolve(configured.trim()), source: 'config' }
  const fromEnv = process.env.DASH_KB_HOME
  if (fromEnv && fromEnv.trim()) return { root: path.resolve(fromEnv.trim()), source: 'env' }
  const fromModule = deriveKbRootFromModule()
  if (fromModule && existsSync(fromModule)) return { root: fromModule, source: 'derived' }
  const fromProfile = deriveKbRootFromProfile()
  if (fromProfile && existsSync(fromProfile)) return { root: fromProfile, source: 'derived' }
  const fallback = path.join(os.homedir(), 'dsh-kb')
  return existsSync(fallback) ? { root: fallback, source: 'fallback' } : { root: '', source: 'none' }
}

/* ------------------------------------------------------------------ *
 * 渐进式记忆加载（L1 个人 → L2 项目 → L3 会话）
 * ------------------------------------------------------------------ */

/** 各层限量（对齐 dsh-kb 体积约定，防上下文爆炸）。 */
const L1_MAX_LINES = 100
const L2_MAX_CARDS = 2
const L2_MAX_LINES = 40
const L3_MAX_DAYS = 3
const L3_MAX_LINES = 30

/** 读取文件前 N 行；文件缺失/读取失败 → null。 */
async function readHead(rel: string, maxLines: number): Promise<string | null> {
  try {
    const text = await readFile(rel, 'utf-8')
    return text.split('\n').slice(0, maxLines).join('\n').trim()
  } catch {
    return null
  }
}

/** 一个已匹配的项目卡（L2）。 */
interface L2Card {
  file: string
  title: string
  head: string
}

/**
 * 从原话提取匹配关键词：英文词（≥3 字符）+ 中文 2-4 字滑窗（去停用词）。
 * 与 router.ts 的 tokenize 同思路，但这里只需「可判等」的集合。
 */
function keywordTokens(text: string): Set<string> {
  const lower = text.toLowerCase()
  const out = new Set<string>()
  for (const m of lower.matchAll(/[a-z][a-z0-9+#.-]{1,30}/gu)) out.add(m[0])
  const cjkRuns = lower.match(/[\u4e00-\u9fa5]+/gu) ?? []
  const STOP = new Set(['的', '了', '和', '与', '及', '或', '是', '在', '我', '你', '他', '它', '这', '那', '一个', '一下', '请', '帮', '帮忙', '可以', '需要', '想要', '要', '把', '给', '对', '模式', '通用', '工作区', '使用', '支持', '适用', '所有', '以及', '继续', '怎么', '如何', '为什么', '这个', '那个', '什么', '干嘛'])
  for (const run of cjkRuns) {
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= run.length; i++) {
        const tok = run.slice(i, i + n)
        if (!STOP.has(tok)) out.add(tok)
      }
    }
  }
  return out
}

/** 判断一段文本是否命中任一关键词。 */
function hitsTokens(text: string, tokens: Set<string>): boolean {
  const lower = text.toLowerCase()
  for (const tok of tokens) {
    if (tok.length >= 3 && lower.includes(tok)) return true
    if (tok.length === 2 && lower.includes(tok)) return true
  }
  return false
}

/**
 * L2 项目匹配：扫描 02-项目/*.md，按 `文件名 + 文件名(去 ext) + 标题行 + frontmatter name`
 * 与原话关键词匹配，取≤2 张（优先 mtime 新）。只读前 40 行。
 */
async function matchProjectCards(root: string, tokens: Set<string>): Promise<L2Card[]> {
  const dir = path.join(root, '02-项目')
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const cards: L2Card[] = []
  for (const n of names.sort()) {
    if (!n.endsWith('.md') || n.toLowerCase() === 'readme.md' || n.startsWith('.')) continue
    const abs = path.join(dir, n)
    try {
      const st = await stat(abs)
      if (!st.isFile()) continue
      const head = await readHead(abs, L2_MAX_LINES)
      if (head === null) continue
      const base = n.slice(0, -3)
      const searchable = `${base} ${base.replace(/-/g, ' ')} ${head.slice(0, 400)}`
      if (!hitsTokens(searchable, tokens)) continue
      const title = head.split('\n').find(l => l.startsWith('#'))?.replace(/^#+\s*/, '').trim() || base
      cards.push({ file: n, title, head })
    } catch {
      /* 单文件失败跳过 */
    }
  }
  // 按 mtime 倒序取前 L2_MAX_CARDS（最近更新的优先）
  const dated = await Promise.all(
    cards.map(async c => ({ c, mtime: (await stat(path.join(dir, c.file))).mtimeMs })),
  )
  return dated
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, L2_MAX_CARDS)
    .map(d => d.c)
}

/** L3 会话记忆：04-每日/ 最近 N 天（文件名 YYYY-MM-DD.md 排序），各取「今日事实」+「沟通/决策」节选。 */
async function recentDiary(root: string, maxDays: number): Promise<string[]> {
  const dir = path.join(root, '04-每日')
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const days = names
    .filter(n => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))
    .sort()
    .reverse()
    .slice(0, maxDays)
  const out: string[] = []
  for (const d of days) {
    const text = await readHead(path.join(dir, d), 200)
    if (text === null) continue
    const lines = text.split('\n')
    // 只保留「今日事实」与「沟通/决策记录」两个小节（每个 ≤12 行），其余丢弃
    const picked: string[] = []
    let section = ''
    for (const line of lines) {
      if (line.startsWith('## ')) {
        section = line.replace(/^##\s*/, '')
        if (section.includes('事实') || section.includes('沟通') || section.includes('决策')) continue
        else { section = '' }
      }
      if (section && line.trim()) picked.push(line)
    }
    const head = picked.slice(0, L3_MAX_LINES).join('\n').trim()
    if (head) out.push(`### ${d}\n${head}`)
  }
  return out
}

/**
 * 渐进式加载记忆上下文（L1 → L2 → L3）。
 *
 * @param cfg - 插件配置（读 kbRoot 字段）
 * @param utterance - 用户原话（L2 匹配关键词来源）
 * @returns MemoryContextResult：ok=false 仅当知识库不可用（命令照常切模式+投递原话）
 */
export async function loadMemoryContext(
  cfg: { kbRoot?: unknown },
  utterance: string,
): Promise<MemoryContextResult> {
  const kb = kbRootInfoOf(cfg)
  if (!kb.root || !existsSync(kb.root)) {
    return {
      ok: false,
      summary: '未找到 dsh-kb 知识库（可配置 kbRoot 或设置 DASH_KB_HOME）——本次未加载记忆，仅切换模式并投递原话。',
      context: '',
    }
  }

  const tokens = keywordTokens(utterance)
  const parts: string[] = []
  const loaded: string[] = []

  // L1 个人记忆（人物画像档案区；缺失不阻塞）
  const persona = await readHead(path.join(kb.root, '01-偏好', '人物画像.md'), L1_MAX_LINES)
  if (persona !== null) {
    parts.push(`【L1 个人记忆 · 人物画像（${kb.source}）】\n${persona}`)
    loaded.push('L1 个人记忆')
  }

  // L2 项目记忆（关键词匹配；缺失/无匹配跳过）
  const cards = await matchProjectCards(kb.root, tokens)
  for (const card of cards) {
    parts.push(`【L2 项目记忆 · ${card.title}（${card.file}）】\n${card.head}`)
  }
  if (cards.length > 0) loaded.push(`L2 项目记忆（${cards.map(c => c.title).join('、')}）`)

  // L3 会话记忆（最近 3 天日记；缺失跳过）
  const diary = await recentDiary(kb.root, L3_MAX_DAYS)
  if (diary.length > 0) {
    parts.push(`【L3 会话记忆 · 最近日记】\n${diary.join('\n\n')}`)
    loaded.push(`L3 会话记忆（近 ${diary.length} 天）`)
  }

  if (parts.length === 0) {
    return {
      ok: true,
      summary: `知识库 ${kb.root} 存在，但没有可加载的记忆层（${kb.source}）——本次仅投递原话。`,
      context: '',
    }
  }

  return {
    ok: true,
    summary: `已加载记忆：${loaded.join('；')}（来自 ${kb.root}，${kb.source}）`,
    context: parts.join('\n\n'),
  }
}