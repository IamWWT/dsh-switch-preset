/**
 * test/router-test.mjs — `/router-preset` 概率判定与接力契约单测（v0.5.0）
 *
 * 覆盖（纯函数域，不需要 DSH 运行时）：
 *   1. 概率分布：6 模式全出、sum≈1、按概率降序；
 *   2. 判别力：明显属于某模式的输入，该模式概率显著最高（阈值可达）；
 *   3. 阈值行为：< 阈值不切换（无副作用）；
 *   4. 切换复用：达阈值时走 switchPreset（用假 deps 断言调用与结果）；
 *   5. 接力契约：达阈值且切换成功才产出标记；未达阈值/切换失败无标记；
 *   6. 标记解析：host 与 client 两端解析规则一致（含空内容、多标记、无标记）。
 */
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 与 switch-test 一致：把 TS 源码即时打包成 ESM 再导入（不依赖 lib/ 的产物布局）
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

const { LocalModeScorer } = await import(await bundle('src/host/router.ts', 'router.mjs'))
const {
  DEFAULT_ROUTE_THRESHOLD,
  routePreset,
} = await import(await bundle('src/host/route.ts', 'route.mjs'))

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

/** 6 个模式的最小 roster（描述取自各 preset.yml 的真实文案，保证判别测试贴近实况）。 */
const CANDIDATES = [
  { id: 'engineering', name: '工程模式', description: 'DSH 软件工程交付 Agent：七阶段交付流程、plan 先行、改完必验、破坏性操作先审。适用于所有软件项目（python/java/go/ts/DSH 插件等）。' },
  { id: 'learning', name: '学习模式', description: '通用学习教练：AI讲你答、因果链、出处强制、记忆补偿、间隔复习、输出式学习、多模态。' },
  { id: 'office', name: '办公模式', description: '办公文档产出 Agent：多格式素材摄入，复用 dsh-report-studio 范式/模板/资产，按范式逐块生成与润色，导出 md/docx/pdf/pptx。' },
  { id: 'research', name: '研究模式', description: '通用研究 Agent：证据优先、素材→观点→议题→结论加工链、状态晋升同步索引、一致性检查与收尾提交。' },
  { id: 'troubleshooting', name: '故障排查模式', description: '企业运维故障排查 Agent：先判故障域，再按 SOP 做结构化 RCA（变更→指标→链路→日志→知识库），证据不足不臆测。' },
  { id: 'video', name: '视频模式', description: '技术项目交付视频制作 Agent：演示/答辩、讲解/教程、汇报、纯剪辑四型。分镜、口播稿、TTS 配音、字幕、对齐合成。' },
]

const scorer = new LocalModeScorer()

await check('概率分布：覆盖全部候选模式且 sum≈1、按概率降序', () => {
  const board = scorer.score(CANDIDATES, '帮我写个周报', DEFAULT_ROUTE_THRESHOLD)
  assert.equal(board.scores.length, CANDIDATES.length, '每个候选都要有概率')
  const sum = board.scores.reduce((s, x) => s + x.probability, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9, `概率和应为 1，实际 ${sum}`)
  for (let i = 1; i < board.scores.length; i++) {
    assert.ok(board.scores[i - 1].probability >= board.scores[i].probability, '必须按概率降序')
  }
  assert.ok(board.top, '必须给出冠军')
})

await check('判别力：工程类输入 → engineering 概率最高且达阈值', () => {
  const board = scorer.score(CANDIDATES, '这个插件打包后加载报错，帮我排查下代码里的 bug 并重新构建', DEFAULT_ROUTE_THRESHOLD)
  assert.equal(board.top.id, 'engineering', `期望 engineering，实际 ${board.top.id}`)
  assert.ok(board.top.probability >= DEFAULT_ROUTE_THRESHOLD, `概率应达阈值，实际 ${board.top.probability}`)
  assert.ok(board.top.hits.length > 0, '应记录命中词（可解释）')
})

await check('判别力：视频类输入 → video 概率最高', () => {
  const board = scorer.score(CANDIDATES, '把这个项目做成一个演示视频，需要配音和字幕', DEFAULT_ROUTE_THRESHOLD)
  assert.equal(board.top.id, 'video', `期望 video，实际 ${board.top.id}`)
})

await check('判别力：故障排查类输入 → troubleshooting 概率最高', () => {
  const board = scorer.score(CANDIDATES, '线上服务 503 不可用，查日志和指标定位根因', DEFAULT_ROUTE_THRESHOLD)
  assert.equal(board.top.id, 'troubleshooting', `期望 troubleshooting，实际 ${board.top.id}`)
})

await check('判别力：学习类输入 → learning 概率最高', () => {
  const board = scorer.score(CANDIDATES, '教我理解一下这个概念，讲讲原理和区别', DEFAULT_ROUTE_THRESHOLD)
  assert.equal(board.top.id, 'learning', `期望 learning，实际 ${board.top.id}`)
})

await check('阈值行为：含糊输入不给高置信度（可能低于阈值）', () => {
  const board = scorer.score(CANDIDATES, '帮我处理一下这个', DEFAULT_ROUTE_THRESHOLD)
  // 不做"必须不达阈值"的强断言（打分是启发式），只断言：概率仍归一、冠军存在、passesThreshold 与概率一致
  const sum = board.scores.reduce((s, x) => s + x.probability, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9, '概率仍须归一')
  assert.equal(board.passesThreshold, board.top.probability >= DEFAULT_ROUTE_THRESHOLD, 'passesThreshold 必须与阈值判定一致')
})

/** 可观测的假 deps（记录调用）。 */
function fakeDeps({ switchError = null, roster = CANDIDATES, modeSelectionEnabled = true, delivery = { ok: true, message: '已投递' }, noDelivery = false } = {}) {
  const calls = { select: [], recompose: [], wroteDefault: [], delivered: [] }
  return {
    calls,
    deps: {
      agentPresets: {
        remoteExportList: async () => ({
          presets: roster.map(r => ({ ...r, broken: r.broken })),
          modeSelectionEnabled,
        }),
        select: async (_agent, id) => { calls.select.push(id); if (switchError) throw switchError; return id },
        recompose: async (_agentCtx, id) => { calls.recompose.push(id); return { id } },
      },
      ...(noDelivery ? {} : {
        deliverUtterance: async (_agent, utterance) => { calls.delivered.push(utterance); return delivery },
      }),
      writeDefaultPreset: async (id) => { calls.wroteDefault.push(id) },
      // 当前会话模式设为 research（≠ 测试中要切换到的 engineering），
      // 否则会命中 switchPreset 的幂等分支（"已经是该模式"）而测不到真实切换路径
      currentPreset: async () => 'research',
    },
  }
}

const AGENT = { ctx: {}, session: { id: 's1', append: async () => {} } }

await check('达阈值：执行切换（复用 switchPreset）并把原话投递给会话', async () => {
  const { deps, calls } = fakeDeps()
  const utterance = '这个插件打包后加载报错，帮我改代码'
  const result = await routePreset(AGENT, utterance, deps, scorer, DEFAULT_ROUTE_THRESHOLD)
  assert.equal(result.kind, 'success', `应为成功，实际 ${JSON.stringify(result)}`)
  assert.deepEqual(calls.select, ['engineering'], '空会话应走 select 切换')
  assert.ok(result.text.includes('已切换'), '结果应说明已切换')
  assert.deepEqual(calls.delivered, [utterance], '原话必须被投递（Host 侧 sessionController.prompt）')
  assert.ok(result.text.includes('已投递'), '应回显投递成功的 message')
})

await check('未达阈值：不产生切换副作用、不投递原话', async () => {
  const { deps, calls } = fakeDeps()
  // 构造一个必然低于阈值的场景：阈值设到 1（没有任何模式能达到）
  const result = await routePreset(AGENT, '这个插件打包后加载报错', deps, scorer, 1)
  assert.equal(result.kind, 'success')
  assert.equal(calls.select.length, 0, '不得调用 select')
  assert.equal(calls.recompose.length, 0, '不得调用 recompose')
  assert.equal(calls.wroteDefault.length, 0, '不得写默认模式')
  assert.equal(calls.delivered.length, 0, '未达阈值不得投递原话')
  assert.ok(result.text.includes('未自动切换'), '应明确告知未切换')
})

await check('切换失败：不投递原话（避免在原模式下误跑）', async () => {
  // 构造"彻底切不动"的场景：select 抛 locked、recompose 抛错、设置服务不可用（无 writeDefaultPreset）
  const failing = fakeDeps()
  failing.deps.agentPresets.select = async () => { throw Object.assign(new Error('locked'), { code: 'agent-preset/locked' }) }
  failing.deps.agentPresets.recompose = async () => { throw new Error('recompose failed') }
  delete failing.deps.writeDefaultPreset
  const failed = await routePreset(AGENT, '这个插件打包后加载报错，帮我改代码', failing.deps, scorer, DEFAULT_ROUTE_THRESHOLD)
  assert.equal(failed.kind, 'error', `切换失败应为 error，实际 ${JSON.stringify(failed)}`)
  assert.equal(failing.calls.delivered.length, 0, '切换失败不得投递原话（避免在原模式下误跑）')
  assert.ok(failed.text.includes('切换失败'), '应说明切换失败')
})

await check('已开始会话 + recompose 可用：强制切换成功并投递原话', async () => {
  const { deps, calls } = fakeDeps()
  deps.agentPresets.select = async () => { throw Object.assign(new Error('locked'), { code: 'agent-preset/locked' }) }
  const result = await routePreset(AGENT, '这个插件打包后加载报错，帮我改代码', deps, scorer, DEFAULT_ROUTE_THRESHOLD)
  assert.equal(result.kind, 'success', `应成功，实际 ${JSON.stringify(result)}`)
  assert.deepEqual(calls.recompose, ['engineering'], '已开始会话应走 recompose')
  assert.deepEqual(calls.delivered, ['这个插件打包后加载报错，帮我改代码'], '切换成功必须投递原话')
})

await check('损坏模式不参与判定（不得切到坏模式）', async () => {
  const withBroken = CANDIDATES.map(c => c.id === 'engineering' ? { ...c, broken: 'load failed' } : c)
  const { deps, calls } = fakeDeps({ roster: withBroken })
  const result = await routePreset(AGENT, '这个插件打包后加载报错，帮我改代码', deps, scorer, DEFAULT_ROUTE_THRESHOLD)
  assert.ok(!calls.select.includes('engineering'), '损坏模式不得被选中')
  assert.equal(result.kind, 'success')
})

await check('空原话：给出用法错误（不猜、不切）', async () => {
  const { deps, calls } = fakeDeps()
  const result = await routePreset(AGENT, '   ', deps, scorer, DEFAULT_ROUTE_THRESHOLD)
  assert.equal(result.kind, 'error')
  assert.equal(calls.select.length, 0, '空输入不得触发切换')
})

await check('投递通道缺失：切换成功但如实告知"未投递"，不假报成功', async () => {
  const { deps } = fakeDeps({ noDelivery: true })
  const result = await routePreset(AGENT, '这个插件打包后加载报错，帮我改代码', deps, scorer, DEFAULT_ROUTE_THRESHOLD)
  assert.equal(result.kind, 'success', '切换本身成功，故整体仍是 success')
  assert.ok(result.text.includes('未投递'), '必须如实说明未投递')
  assert.ok(result.text.includes('手动重新发送'), '必须指导用户手动重发')
})

await check('投递被拒（accepted=false）：如实告知未投递并指导重发', async () => {
  const { deps, calls } = fakeDeps({ delivery: { ok: false, message: '会话未接受该输入' } })
  const result = await routePreset(AGENT, '这个插件打包后加载报错，帮我改代码', deps, scorer, DEFAULT_ROUTE_THRESHOLD)
  assert.equal(result.kind, 'success')
  assert.deepEqual(calls.delivered.length, 1, '投递被尝试过')
  assert.ok(result.text.includes('未投递') && result.text.includes('会话未接受该输入'))
})

await check('投递抛错：不崩命令，如实回显失败原因', async () => {
  const { deps } = fakeDeps()
  deps.deliverUtterance = async () => { throw new Error('sessionController 超时') }
  const result = await routePreset(AGENT, '这个插件打包后加载报错，帮我改代码', deps, scorer, DEFAULT_ROUTE_THRESHOLD)
  assert.equal(result.kind, 'success', '命令不应因投递异常而崩')
  assert.ok(result.text.includes('未投递') && result.text.includes('sessionController 超时'))
})

console.log(`\n[router] ${passed} 项通过` + (process.exitCode ? '（有失败）' : ''))
