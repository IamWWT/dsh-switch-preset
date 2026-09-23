/**
 * test/switch-test.mjs — switch.ts 纯逻辑单测（不依赖 DSH 运行时）
 *
 * 覆盖 v1.2 行为矩阵（spec AC-2/4/12~17 逻辑侧）：
 *   1. /list-preset：列出 id + 中文名 + 中文描述 + 当前/默认标注
 *   2. 无参 /switch-preset 与 /list-preset 同源输出
 *   3. 空会话 → 就地 select（留在当前会话）
 *   4. 已开始会话（locked）+ 宿主支持 recompose → **强制切换当前会话**（含历史）
 *      + append agent-preset/selected 事件 + 警告文本；不写默认
 *   5. 目标 == 当前模式 → 幂等（不 recompose、不写默认）
 *   6. 目标不存在 / broken / 非法 id → error，零副作用
 *   7. locked + 宿主无 recompose → 降级：写默认模式 + 明示
 *   8. locked + 无 recompose + 无设置服务 → 明确 error（不静默）
 *   9. recompose 抛错 → 明确 error
 *  10. select 非锁定错误 → 原样报错
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`)
  else {
    failures += 1
    console.error(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`)
  }
}

const outfile = resolve(root, 'lib-test/switch.mjs')
await build({
  entryPoints: [resolve(root, 'src/host/switch.ts')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  charset: 'utf8',
  external: ['node:*', '@deepseek-ai/*'],
  logLevel: 'silent',
})
const { switchPreset, listPresets } = await import(pathToFileURL(outfile).href)

/** 夹具：roster 本机真实形状（中文名+中文描述+默认标注）；支持 recompose 可选。 */
function makeDeps(overrides = {}, { withRecompose = true, modeSelectionEnabled = true } = {}) {
  const calls = { select: [], setDefault: [], recompose: [], append: [] }
  // 0.1.7 契约：roster 通过 remoteExportList() 返回 { presets, modeSelectionEnabled }，
  // 行字段是 name（不再是 displayName），broken 是"损坏原因"字符串。
  const presets = {
    remoteExportList: async () => {
      calls.list += 1
      return {
        presets: [
          { id: 'engineering', name: '工程模式', description: 'DSH 软件工程交付 Agent：七阶段交付流程…' },
          { id: 'research', name: '研究模式', description: '通用研究 Agent：证据优先…', isDefault: true },
          { id: 'broken-x', broken: 'composition 加载失败', description: '损坏示例' },
        ],
        modeSelectionEnabled: modeSelectionEnabled,
      }
    },
    select: async (_agent, id) => { calls.select.push(id); return id },
    ...(withRecompose
      ? {
        recompose: async (_agentCtx, id) => { calls.recompose.push(id); return { id } },
      }
      : {}),
  }
  return {
    agentPresets: presets,
    writeDefaultPreset: async (id) => { calls.setDefault.push(id) },
    currentPreset: async () => 'engineering',
    calls,
    ...overrides,
  }
}
const agent = {
  ctx: { kind: 'agent-scope' },
  session: {
    id: 'session-33333333-3333-4333-8333-333333333333',
    append: (type, data) => { makeDeps().calls || null; return null },
  },
}

console.log('[1/10] /list-preset：中文名 + 中文描述 + 当前/默认标注')
{
  const deps = makeDeps()
  const r = await listPresets(agent, deps)
  check('kind=success', r.kind === 'success')
  check('含中文名「工程模式」', r.text.includes('工程模式（engineering）'))
  check('含中文描述', r.text.includes('七阶段交付流程'))
  check('标注当前会话', r.text.includes('当前会话'))
  check('标注默认模式', r.text.includes('默认'))
  check('含用法提示', r.text.includes('/switch-preset <id>'))
  check('broken 归入不可用', r.text.includes('已损坏'))
}

console.log('[2/10] 无参 /switch-preset 与 /list-preset 同源')
{
  const a = await switchPreset(agent, '', makeDeps())
  const b = await listPresets(agent, makeDeps())
  check('输出一致', a.text === b.text)
}

console.log('[3/10] 空会话 → 就地 select（留在当前会话）')
{
  const deps = makeDeps()
  const r = await switchPreset(agent, '  research  ', deps)
  check('kind=success', r.kind === 'success')
  check('调 select 且 id 正确（含 trim）', deps.calls.select.length === 1 && deps.calls.select[0] === 'research')
  check('未写默认模式', deps.calls.setDefault.length === 0)
  check('未触发 recompose', deps.calls.recompose.length === 0)
  check('文本含中文名', r.text.includes('研究模式（research）'))
  check('文本声明就地生效', r.text.includes('就地生效'))
}

console.log('[4/10] 已开始会话（locked）→ recompose 强制切换（含历史）')
{
  const locked = new Error('session "x" has already started; its agent preset is fixed')
  locked.code = 'agent-preset/locked'
  const deps = makeDeps()
  deps.agentPresets.select = async () => { throw locked }
  const agentWithAppend = {
    ctx: { kind: 'agent-scope' },
    session: {
      id: agent.session.id,
      append: (type, data) => { deps.calls.append.push({ type, data }) },
    },
  }
  const r = await switchPreset(agentWithAppend, 'research', deps)
  check('kind=success', r.kind === 'success')
  check('调 recompose 且 id=research', deps.calls.recompose.length === 1 && deps.calls.recompose[0] === 'research')
  check('append 了 agent-preset/selected', deps.calls.append.length === 1
    && deps.calls.append[0].type === 'agent-preset/selected'
    && deps.calls.append[0].data.agentPreset === 'research')
  check('未写默认模式', deps.calls.setDefault.length === 0)
  check('文本含"就地切换"', r.text.includes('就地切换'))
  check('文本含工具解析警告', r.text.includes('工具'))
}

console.log('[5/10] 目标 == 当前模式 → 幂等')
{
  const locked = new Error('already started')
  locked.code = 'agent-preset/locked'
  const deps = makeDeps()
  deps.agentPresets.select = async () => { throw locked }
  const r = await switchPreset(agent, 'engineering', deps)
  check('kind=success', r.kind === 'success')
  check('未 recompose / 未写默认', deps.calls.recompose.length === 0 && deps.calls.setDefault.length === 0)
  check('文本说明已是该模式', r.text.includes('已经是'))
}

console.log('[6/10] 目标不可用 / 非法 id → error 零副作用')
{
  const deps = makeDeps()
  const r1 = await switchPreset(agent, 'nope', deps)
  check('不存在 → error', r1.kind === 'error' && r1.text.includes('不可用'))
  const r2 = await switchPreset(agent, 'broken-x', deps)
  check('broken → error', r2.kind === 'error')
  const r3 = await switchPreset(agent, 'Bad_ID', deps)
  check('非法格式 → error', r3.kind === 'error' && r3.text.includes('格式不正确'))
  check('全程未调 select / recompose / setDefault', deps.calls.select.length === 0
    && deps.calls.recompose.length === 0 && deps.calls.setDefault.length === 0)
}

console.log('[7/10] locked + 宿主无 recompose → 降级写默认模式')
{
  const locked = new Error('already started')
  locked.code = 'agent-preset/locked'
  const deps = makeDeps({}, { withRecompose: false })
  deps.agentPresets.select = async () => { throw locked }
  const r = await switchPreset(agent, 'research', deps)
  check('kind=success', r.kind === 'success')
  check('写了默认模式 research', deps.calls.setDefault.length === 1 && deps.calls.setDefault[0] === 'research')
  check('文本含"不支持强制切换"', r.text.includes('不支持强制切换'))
  check('文本指明当前仍为 engineering', r.text.includes('engineering'))
}

console.log('[8/10] locked + 无 recompose + 无设置服务 → error（不静默）')
{
  const locked = new Error('already started')
  locked.code = 'agent-preset/locked'
  const deps = makeDeps({ writeDefaultPreset: undefined }, { withRecompose: false })
  deps.agentPresets.select = async () => { throw locked }
  const r = await switchPreset(agent, 'research', deps)
  check('kind=error', r.kind === 'error')
  check('文本点明设置服务不可用', r.text.includes('设置服务不可用'))
}

console.log('[9/10] recompose 抛错 → 明确 error')
{
  const locked = new Error('already started')
  locked.code = 'agent-preset/locked'
  const deps = makeDeps()
  deps.agentPresets.select = async () => { throw locked }
  deps.agentPresets.recompose = async () => { throw new Error('composition exploded') }
  const r = await switchPreset(agent, 'research', deps)
  check('kind=error 且含根因', r.kind === 'error' && r.text.includes('composition exploded'))
}

console.log('[10/10] select 非锁定错误 → 原样报错')
{
  const deps = makeDeps()
  deps.agentPresets.select = async () => { throw new Error('composition exploded') }
  const r = await switchPreset(agent, 'research', deps)
  check('kind=error 且含根因', r.kind === 'error' && r.text.includes('composition exploded'))
}

console.log(failures === 0 ? '\n✅ switch-test 全部通过' : `\n❌ ${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
console.log('[11/11] modeSelectionEnabled=false：写默认模式不生效 → 显式失败（不假报成功）')
{
  const deps = makeDeps({}, { withRecompose: false, modeSelectionEnabled: false })
  deps.agentPresets.select = async () => { throw locked }
  const r = await switchPreset(agent, 'research', deps)
  check('kind=error', r.kind === 'error')
  check('说明模式选择已关闭', r.text.includes('模式选择'))
  check('未写默认模式（不制造无效写入）', deps.calls.setDefault.length === 0)
}
