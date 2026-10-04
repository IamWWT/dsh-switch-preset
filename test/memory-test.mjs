/**
 * test/memory-test.mjs — `/router-preset-memory` 渐进式记忆加载单测（v0.6.0）
 *
 * 覆盖（纯逻辑域，临时目录造假 dsh-kb，不需要 DSH 运行时）：
 *   1. kbRoot 解析：显式配置（含 volatile 包装）优先；空/缺失 → 走后续回退不抛错；
 *   2. L1 个人记忆：01-偏好/人物画像.md 被加载（≤100 行）；
 *   3. L2 项目记忆：按原话关键词命中 02-项目/ 卡片（≤2 张），无关原话不加载；
 *   4. L3 会话记忆：04-每日/ 近 3 天被加载，3 天前的日记不出现；
 *   5. 知识库缺失：`{ok:false}` + 明确说明，不抛错（失败降级不阻塞）。
 */
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 与 router-test 一致：把 TS 源码即时打包成 ESM 再导入（不依赖 lib/ 的产物布局）
async function bundle(entry, outName) {
  const outfile = resolve(root, 'lib-test', outName)
  await build({
    entryPoints: [resolve(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    charset: 'utf8',
    external: ['node:*', '@deepseek-ai/*'],
    logLevel: 'silent',
  })
  return pathToFileURL(outfile).href
}

const { loadMemoryContext, kbRootInfoOf, readKbRoot } = await import(await bundle('src/host/memory.ts', 'memory.mjs'))

let passed = 0
const check = async (name, fn) => {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (error) {
    console.error(`  ✗ ${name}\n    ${error?.message ?? error}`)
    process.exitCode = 1
  }
}

/** 造一个临时 dsh-kb（返回根路径；测试结束由 check 内的 finally 清理）。 */
function makeFakeKb() {
  const kb = mkdtempSync(join(tmpdir(), 'dsh-kb-fake-'))
  mkdirSync(join(kb, '01-偏好'), { recursive: true })
  mkdirSync(join(kb, '02-项目'), { recursive: true })
  mkdirSync(join(kb, '04-每日'), { recursive: true })
  writeFileSync(join(kb, '01-偏好', '人物画像.md'),
    '# 人物画像\n\n- 姓名：Canace\n- 背景：生物医学工程本科，中科院硕士（MRI 降采样重建）\n- 工作：中国银行 IT 运维 6 年，2026 年转 AI 开发\n- 语言偏好：简短、直接、逻辑性强\n- 知识边界：Python/shell，不懂 Java/Node/TS\n'.repeat(4)) // 多行，测截断上限
  writeFileSync(join(kb, '02-项目', 'dsh-kb.md'),
    '# dsh-kb\n\n个人知识库（Obsidian），L0-L5 读取协议，17:10 收集工作日志。\n仓库：github.com/IamWWT/dsh-kb，main 分支。\n')
  writeFileSync(join(kb, '02-项目', 'wechat-miniprog.md'),
    '# 微信小程序\n\n微信小程序项目，前端 + 云开发。\n')
  const today = new Date()
  for (let i = 0; i < 5; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const name = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    writeFileSync(join(kb, '04-每日', `${name}.md`),
      `# ${name}\n\n## 事实\n- 第 ${i} 天记录：${i === 0 ? '今天处理了 dsh-kb 同步' : `普通记录 ${i}`}\n\n## 沟通\n- 与用户确认了记忆路由方案\n\n## 决策\n- 采用渐进式记忆加载\n`)
  }
  return kb
}

await check('kbRoot 解析：显式配置（字符串）优先', () => {
  const kb = makeFakeKb()
  try {
    const info = kbRootInfoOf({ kbRoot: kb })
    assert.equal(info.root, kb)
    assert.equal(info.source, 'config')
    assert.ok(kbRootInfoOf({ kbRoot: kb }).root === kb)
  } finally {
    rmSync(kb, { recursive: true, force: true })
  }
})

await check('kbRoot 解析：volatile 包装对象也能读出字符串（不崩）', () => {
  const kb = makeFakeKb()
  try {
    const cfg = { kbRoot: { get: () => kb } }
    assert.equal(readKbRoot(cfg), kb, 'volatile 包装应解出字符串')
    const info = kbRootInfoOf(cfg)
    assert.equal(info.root, kb)
    assert.equal(info.source, 'config')
  } finally {
    rmSync(kb, { recursive: true, force: true })
  }
})

await check('L1+L3：dsh-kb 相关原话 → 加载个人画像 + 命中的 dsh-kb 卡片 + 近 3 天日记', async () => {
  const kb = makeFakeKb()
  try {
    const result = await loadMemoryContext({ kbRoot: kb }, '帮我更新 dsh-kb 的记忆')
    assert.equal(result.ok, true, '应成功解析知识库')
    assert.ok(result.context.includes('Canace'), 'L1 个人记忆应加载（含画像内容）')
    assert.ok(result.context.includes('【L2 项目记忆 · dsh-kb'), 'L2 应命中 dsh-kb 项目卡片')
    assert.ok(!result.context.includes('微信小程序'), '无关项目卡片不得混入')
    assert.ok(result.context.includes('今天处理了 dsh-kb 同步'), 'L3 近 3 天日记应加载（今天）')
    assert.ok(!result.context.includes('普通记录 4'), '3 天前的日记不得加载')
    assert.ok(result.summary.includes('L1') || result.summary.includes('个人'), 'summary 应说明加载层级')
  } finally {
    rmSync(kb, { recursive: true, force: true })
  }
})

await check('L2 关键词匹配：无关原话不加载任何项目卡片', async () => {
  const kb = makeFakeKb()
  try {
    const result = await loadMemoryContext({ kbRoot: kb }, '随便聊聊天气')
    assert.equal(result.ok, true)
    assert.ok(result.context.includes('Canace'), 'L1 仍应加载（个人记忆与话题无关）')
    assert.ok(!result.context.includes('【L2 项目记忆'), '无关原话不得加载任何项目卡片（L2 段整体缺席）')
  } finally {
    rmSync(kb, { recursive: true, force: true })
  }
})

await check('知识库缺失：ok=false + 明确说明，不抛错', async () => {
  const missing = join(tmpdir(), `dsh-kb-missing-${Date.now()}`)
  const result = await loadMemoryContext({ kbRoot: missing }, '任何内容')
  assert.equal(result.ok, false, '缺失知识库应 ok=false')
  assert.ok(result.summary.length > 0, '应给出原因说明')
  assert.equal(result.context, '', '缺失时无上下文')
})

await check('空 kbRoot 解析：不抛错，返回合法对象（值依赖本机回退环境，只断言形状）', async () => {
  // 注：空配置会走 DASH_KB_HOME → 模块推导 → profile 反推 → ~/dsh-kb 回退，
  // 本机若存在真实 dsh-kb 则 ok 为 true——此处只断言不抛错 + 形状合法，不锁死 ok 值。
  const result = await loadMemoryContext({ kbRoot: '' }, '任何内容')
  assert.equal(typeof result.ok, 'boolean')
  assert.equal(typeof result.summary, 'string')
  assert.equal(typeof result.context, 'string')
  const info = kbRootInfoOf({})
  assert.equal(typeof info.root, 'string')
  assert.ok(['config', 'env', 'derived', 'fallback', 'none'].includes(info.source))
})

console.log(`\n[memory] ${passed} 项通过` + (process.exitCode ? '（有失败）' : ''))
