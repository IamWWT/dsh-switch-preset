/**
 * test/settings-test.mjs — 路由参数的可配面单测（v0.5.1，闭合 spec 002 未决项 U1）
 *
 * 覆盖（纯函数/假上下文，不需要 DSH 运行时）：
 *   1. 归一化：缺省 → 出厂默认（自动切换开、阈值 0.6）；越界/非数/非布尔 → 回落默认，不抛错；
 *   2. 写入校验：合法 ops 形状（路径 `['routerSettings', <key>]`）；未知字段/越界/空操作 → 明确错误；
 *   3. 门面读：volatile 引用缺失/抛错 → 默认值（命令不会因设置面故障失效）；
 *   4. 门面写：命名空间 = 条目 id、revision 回传、settings 服务缺失 → 明确报错；
 *   5. 门面 watch：`loader/volatile-update` 命中 `routerSettings` → changed=true（含忽略无关路径）；
 *   6. REST 数据面：GET 返回 { value, revision }；PUT 合法 → 写入并回显；非法 → 400 且不写。
 */
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

const {
  DEFAULT_ROUTER_SETTINGS,
  ROUTER_THRESHOLD_MAX,
  ROUTER_THRESHOLD_MIN,
  isValidRouterThreshold,
  normalizeRouterSettings,
  normalizeRouterThreshold,
} = await import(await bundle('src/shared/router-settings.ts', 'router-settings.mjs'))
const {
  buildWriteOps,
  createRouterSettingsFacade,
  registerRouterSettingsRoutes,
  SETTINGS_FIELD,
  SETTINGS_NAMESPACE,
} = await import(await bundle('src/host/settings.ts', 'host-settings.mjs'))

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

/* ---------------- 1. 归一化 ---------------- */

await check('缺省参数 → 出厂默认（自动切换开启、阈值 0.6）', () => {
  assert.deepEqual(normalizeRouterSettings(undefined), { routerEnabled: true, routerThreshold: 0.6 })
  assert.deepEqual(DEFAULT_ROUTER_SETTINGS, { routerEnabled: true, routerThreshold: 0.6 })
})

await check('合法参数原样保留（含边界 0 与 1）', () => {
  assert.deepEqual(normalizeRouterSettings({ routerEnabled: false, routerThreshold: 0.85 }),
    { routerEnabled: false, routerThreshold: 0.85 })
  assert.equal(normalizeRouterThreshold(ROUTER_THRESHOLD_MIN), 0)
  assert.equal(normalizeRouterThreshold(ROUTER_THRESHOLD_MAX), 1)
  assert.equal(isValidRouterThreshold(0), true)
  assert.equal(isValidRouterThreshold(1), true)
})

await check('非法阈值（越界/非数/NaN/Infinity）→ 回落默认 0.6，不抛错', () => {
  for (const bad of [1.5, -0.2, Number.NaN, Number.POSITIVE_INFINITY, '0.8', null, undefined, {}]) {
    assert.equal(normalizeRouterThreshold(bad), DEFAULT_ROUTER_SETTINGS.routerThreshold,
      `阈值 ${String(bad)} 应回落默认`)
  }
  assert.equal(isValidRouterThreshold(1.5), false)
  assert.equal(isValidRouterThreshold('0.5'), false)
})

await check('非法/缺失开关与损坏整体对象 → 字段级回落，不抛错', () => {
  assert.deepEqual(normalizeRouterSettings({ routerEnabled: 'yes', routerThreshold: 0.7 }),
    { routerEnabled: true, routerThreshold: 0.7 })
  assert.deepEqual(normalizeRouterSettings({ routerThreshold: 9 }),
    { routerEnabled: true, routerThreshold: 0.6 })
  assert.deepEqual(normalizeRouterSettings(null), { routerEnabled: true, routerThreshold: 0.6 })
  assert.deepEqual(normalizeRouterSettings('boom'), { routerEnabled: true, routerThreshold: 0.6 })
})

/* ---------------- 2. 写入校验 ---------------- */

await check('合法写入 → 路径为 ["routerSettings", <key>] 的 set ops', () => {
  const ops = buildWriteOps({ fields: { routerEnabled: false, routerThreshold: 0.4 } })
  assert.deepEqual(ops, [
    { op: 'set', path: [SETTINGS_FIELD, 'routerEnabled'], value: false },
    { op: 'set', path: [SETTINGS_FIELD, 'routerThreshold'], value: 0.4 },
  ])
})

await check('未知字段 → 明确错误（不静默忽略）', () => {
  assert.throws(() => buildWriteOps({ fields: { nope: 1 } }), /未知设置项：nope/)
  assert.throws(() => buildWriteOps({ clear: ['nope'] }), /未知设置项：nope/)
})

await check('越界/非数阈值 → 明确错误（host 侧上下限校验）', () => {
  assert.throws(() => buildWriteOps({ fields: { routerThreshold: 1.5 } }), /超出范围/)
  assert.throws(() => buildWriteOps({ fields: { routerThreshold: -1 } }), /超出范围/)
  assert.throws(() => buildWriteOps({ fields: { routerThreshold: 'abc' } }), /必须是数字/)
  assert.throws(() => buildWriteOps({ fields: { routerEnabled: 'on' } }), /必须是布尔值/)
})

await check('空操作 → 明确错误', () => {
  assert.throws(() => buildWriteOps({}), /至少其一/)
  assert.throws(() => buildWriteOps({ fields: {}, clear: [] }), /至少其一/)
})

/* ---------------- 3~5. 门面（假上下文） ---------------- */

/** 可观测的假 host 上下文 + 假 settings 服务。 */
function fakeHost({ entryId = SETTINGS_NAMESPACE, settingsValue = undefined, getThrows = false, withService = true } = {}) {
  const calls = { mutate: [], listeners: new Map() }
  const service = {
    describe: () => [{ ns: entryId, revision: 7 }],
    mutate: async (ns, ops, revision) => {
      calls.mutate.push({ ns, ops, revision })
    },
  }
  const ctx = {
    get: (key) => {
      if (getThrows) throw new Error('boom')
      return key === 'settings' && withService ? service : undefined
    },
    on: (event, listener) => {
      const list = calls.listeners.get(event) ?? []
      list.push(listener)
      calls.listeners.set(event, list)
      return () => calls.listeners.set(event, (calls.listeners.get(event) ?? []).filter(fn => fn !== listener))
    },
    fiber: { entry: { options: { id: entryId } } },
  }
  // 模拟 loader 的 loader/volatile-update 广播（真实事件由 vendor/loader 的 _commitVolatile 发出）
  const emit = (event, payload) => {
    for (const listener of [...(calls.listeners.get(event) ?? [])]) listener(payload)
  }
  // settingsValue 传 'THROW' 时把 getter 换成会抛错的实现（模拟损坏的 volatile 引用）
  const config = settingsValue === undefined
    ? undefined
    : {
        routerSettings: {
          get: settingsValue === 'THROW'
            ? () => { throw new Error('broken') }
            : () => settingsValue,
        },
      }
  return { ctx, config, calls, emit }
}

await check('门面读：volatile 引用缺失/抛错/损坏 → 默认值（命令不因设置面故障失效）', () => {
  assert.deepEqual(createRouterSettingsFacade(fakeHost().ctx, undefined).getSettings(),
    { routerEnabled: true, routerThreshold: 0.6 })

  const broken = fakeHost({ settingsValue: 'THROW' })
  assert.deepEqual(createRouterSettingsFacade(broken.ctx, broken.config).getSettings(),
    { routerEnabled: true, routerThreshold: 0.6 }, 'getter 抛错必须回落默认')

  const dirty = fakeHost({ settingsValue: { routerEnabled: false, routerThreshold: 3 } })
  assert.deepEqual(createRouterSettingsFacade(dirty.ctx, dirty.config).getSettings(),
    { routerEnabled: false, routerThreshold: 0.6 }, '越界值读出来也要回落')
})

await check('门面写：命名空间 = 条目 id，ops 走 routerSettings 路径，revision 回传', async () => {
  const host = fakeHost({ entryId: 'switch-preset' })
  const facade = createRouterSettingsFacade(host.ctx, undefined)
  const out = await facade.write({ fields: { routerThreshold: 0.75 }, expectedRevision: 7 })
  assert.equal(host.calls.mutate.length, 1)
  assert.equal(host.calls.mutate[0].ns, 'switch-preset', '命名空间必须是 profile 条目 id（非包名）')
  assert.deepEqual(host.calls.mutate[0].ops, [{ op: 'set', path: ['routerSettings', 'routerThreshold'], value: 0.75 }])
  assert.equal(host.calls.mutate[0].revision, 7)
  assert.equal(out.revision, 7, '回传当前 revision')
})

await check('门面写：settings 服务缺失 / 非法值 → 明确报错（不假装成功）', async () => {
  const noService = createRouterSettingsFacade(fakeHost({ withService: false }).ctx, undefined)
  await assert.rejects(() => noService.write({ fields: { routerEnabled: false } }), /settings 服务不可用/)
  const host = fakeHost()
  const facade = createRouterSettingsFacade(host.ctx, undefined)
  await assert.rejects(() => facade.write({ fields: { routerThreshold: 2 } }), /超出范围/)
  assert.equal(host.calls.mutate.length, 0, '非法值不得写入')
})

await check('门面 watch：routerSettings 变更 → changed=true；无关路径 → 忽略', async () => {
  const host = fakeHost()
  const facade = createRouterSettingsFacade(host.ctx, undefined)
  assert.equal((host.calls.listeners.get('loader/volatile-update') ?? []).length, 0, '未调用 watch 前不注册监听器')

  const ignored = facade.watch(5000)
  assert.equal((host.calls.listeners.get('loader/volatile-update') ?? []).length, 1, 'watch 必须监听 loader/volatile-update')
  host.emit('loader/volatile-update', [['otherSettings', 'x']])
  assert.equal((await ignored).changed, false, '无关路径不得误报变更')

  const hit = facade.watch(5000)
  host.emit('loader/volatile-update', [[SETTINGS_FIELD, 'routerThreshold']])
  const out = await hit
  assert.equal(out.changed, true)
  assert.equal(out.revision, 7)
})

await check('门面 watch：超时（下限 2s）返回 changed=false，且监听器已回收', async () => {
  const host = fakeHost()
  const facade = createRouterSettingsFacade(host.ctx, undefined)
  const out = await facade.watch(10)
  assert.equal(out.changed, false)
  assert.equal((host.calls.listeners.get('loader/volatile-update') ?? []).length, 0, 'settle 后必须解绑，避免监听泄漏')
})

/* ---------------- 6. REST 数据面 ---------------- */

/** 假 webServer：记录注册的路由。 */
function fakeWebServer() {
  const routes = new Map()
  return {
    routes,
    register: (route) => {
      routes.set(route.path, route)
      return () => routes.delete(route.path)
    },
  }
}

/** 假 req：`on` 与 `send` 任意先后都成立（先注册后发送、先发送后注册均可）。 */
function fakeReq({ method = 'GET', url = '/api/dsh-switch-preset/settings', body = '' } = {}) {
  const handlers = new Map()
  const sent = { data: false, end: false }
  const fire = (event) => {
    const fn = handlers.get(event)
    if (!fn) return
    if (event === 'data') fn(Buffer.from(body, 'utf8'))
    else fn()
  }
  return {
    req: {
      method,
      url,
      on: (event, fn) => {
        handlers.set(event, fn)
        // 已经"发送"过的事件立即回调，避免依赖 on/发送的先后顺序
        if (event === 'data' && sent.data) fire('data')
        if (event === 'end' && sent.end) fire('end')
      },
      destroy: () => {},
    },
    send() {
      sent.data = true
      sent.end = true
      fire('data')
      fire('end')
    },
  }
}

function fakeRes() {
  const out = { status: 0, headers: {}, body: '' }
  return {
    out,
    res: {
      writeHead: (status, headers) => {
        out.status = status
        out.headers = headers ?? {}
      },
      end: (payload) => {
        out.body = payload ?? ''
      },
    },
  }
}

await check('REST：注册 /settings 与 /settings/watch（exact）', () => {
  const ws = fakeWebServer()
  registerRouterSettingsRoutes(ws, createRouterSettingsFacade(fakeHost().ctx, undefined))
  assert.deepEqual([...ws.routes.keys()].sort(), [
    '/api/dsh-switch-preset/settings',
    '/api/dsh-switch-preset/settings/watch',
  ])
  assert.ok([...ws.routes.values()].every(r => r.kind === 'exact'))
})

await check('REST GET /settings → { value, revision }', async () => {
  const host = fakeHost({ settingsValue: { routerEnabled: false, routerThreshold: 0.9 } })
  const ws = fakeWebServer()
  registerRouterSettingsRoutes(ws, createRouterSettingsFacade(host.ctx, host.config))
  const { req, send } = fakeReq({ method: 'GET' })
  const { res, out } = fakeRes()
  await send()
  await ws.routes.get('/api/dsh-switch-preset/settings').handler(req, res)
  assert.equal(out.status, 200)
  const body = JSON.parse(out.body)
  assert.deepEqual(body.value, { routerEnabled: false, routerThreshold: 0.9 })
  assert.equal(body.revision, 7)
  assert.equal(body.writable, true)
})

await check('REST PUT /settings 合法 → 写入并回显；非法 → 400 且不写', async () => {
  const host = fakeHost()
  const ws = fakeWebServer()
  registerRouterSettingsRoutes(ws, createRouterSettingsFacade(host.ctx, undefined))
  const handler = ws.routes.get('/api/dsh-switch-preset/settings').handler

  const okReq = fakeReq({ method: 'PUT', body: JSON.stringify({ fields: { routerEnabled: false }, expectedRevision: 7 }) })
  const okRes = fakeRes()
  await okReq.send()
  await handler(okReq.req, okRes.res)
  assert.equal(okRes.out.status, 200)
  assert.equal(JSON.parse(okRes.out.body).ok, true)
  assert.equal(host.calls.mutate.length, 1)

  const badReq = fakeReq({ method: 'PUT', body: JSON.stringify({ fields: { routerThreshold: 5 } }) })
  const badRes = fakeRes()
  await badReq.send()
  await handler(badReq.req, badRes.res)
  assert.equal(badRes.out.status, 400, '越界阈值必须 400')
  assert.match(JSON.parse(badRes.out.body).error, /超出范围/)
  assert.equal(host.calls.mutate.length, 1, '非法写入不得触碰 settings.mutate')
})

await check('REST：坏 JSON → 400；不支持的方法 → 405', async () => {
  const host = fakeHost()
  const ws = fakeWebServer()
  registerRouterSettingsRoutes(ws, createRouterSettingsFacade(host.ctx, undefined))
  const handler = ws.routes.get('/api/dsh-switch-preset/settings').handler

  const badJson = fakeReq({ method: 'PUT', body: '{oops' })
  const badJsonRes = fakeRes()
  await badJson.send()
  await handler(badJson.req, badJsonRes.res)
  assert.equal(badJsonRes.out.status, 400)

  const del = fakeReq({ method: 'DELETE' })
  const delRes = fakeRes()
  await handler(del.req, delRes.res)
  assert.equal(delRes.out.status, 405)
})

await check('REST watch：请求超时（100ms）→ 被下限夹到 2s 并返回 changed=false', async () => {
  const ws = fakeWebServer()
  registerRouterSettingsRoutes(ws, createRouterSettingsFacade(fakeHost().ctx, undefined))
  const { req, send } = fakeReq({ method: 'GET', url: '/api/dsh-switch-preset/settings/watch?timeoutMs=100' })
  const { res, out } = fakeRes()
  await send()
  const started = Date.now()
  await ws.routes.get('/api/dsh-switch-preset/settings/watch').handler(req, res)
  const elapsed = Date.now() - started
  assert.equal(out.status, 200)
  assert.equal(JSON.parse(out.body).changed, false)
  assert.ok(elapsed >= 1900, `应至少等待下限 2s，实际 ${elapsed}ms`)
})

/* ---------------- 7. 插件行 Config schema ---------------- */

const { Config } = await import(await bundle('src/shared/router-settings.ts', 'router-settings-2.mjs'))

await check('Config schema：缺省解析出默认参数且带 volatile 引用（0.1.7 原生设置面形状）', () => {
  const out = Config['~standard'].validate({})
  assert.equal(out.issues, undefined, `不该有校验错误：${JSON.stringify(out.issues)}`)
  assert.deepEqual(out.value.routerSettings.get(), { routerEnabled: true, routerThreshold: 0.6 })
  const explicit = Config['~standard'].validate({ routerSettings: { routerEnabled: false, routerThreshold: 0.9 } })
  assert.deepEqual(explicit.value.routerSettings.get(), { routerEnabled: false, routerThreshold: 0.9 })
  const bad = Config['~standard'].validate({ routerSettings: { routerThreshold: 5 } })
  assert.ok(bad.issues?.length, '越界值在 schema 层就被拒（loader 侧日志告警、运行值不变）')
})

/* ---------------- 8. 配置卡片（plugins.bundle.config 的正文组件） ---------------- */

const { createSettingsCard } = await import(await bundle('src/client/settings-card.ts', 'settings-card.mjs'))

/** 极简 React 假实现（同 picker-test 思路：useState 用外部数组按 hook 序号保存）。 */
function fakeReact() {
  const cells = []
  let cursor = 0
  /** 本次 render 收集到的 effect（用于手动触发，模拟挂载）。 */
  let effects = []
  return {
    cells,
    reset: () => { cursor = 0; effects = [] },
    /** 触发最近一次 render 注册的 effect（模拟组件挂载）。 */
    mount: () => { for (const fn of effects) fn() },
    React: {
      createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
      useState(initial) {
        const index = cursor++
        if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial
        return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }]
      },
      useRef(initial) {
        const index = `ref${cursor++}`
        if (!(index in cells)) cells[index] = { current: initial }
        return cells[index]
      },
      useEffect(fn) { effects.push(fn) },
    },
  }
}

/** 深度优先找出满足谓词的节点（含嵌套数组子节点）。 */
function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of node.children?.flat(Infinity) ?? []) {
    const hit = findNode(child, predicate)
    if (hit) return hit
  }
  return undefined
}

/** 按 id 找控件。 */
function byId(tree, id) {
  return findNode(tree, node => node.props?.id === id)
}

/** 可观测的假设置数据面。 */
function fakeScope(initialValue, { failWrite = null } = {}) {
  const calls = { setFields: [] }
  const snapshot = { status: 'ok', value: { ...initialValue }, revision: 3 }
  return {
    calls,
    snapshot,
    scope: {
      getSnapshot: () => ({ ...snapshot }),
      subscribe: () => () => {},
      set: async () => {},
      setFields: async fields => {
        calls.setFields.push(fields)
        if (failWrite) throw failWrite
        Object.assign(snapshot.value, fields)
        snapshot.revision += 1
      },
      unset: async () => {},
    },
  }
}

/** 渲染卡片（hook 序号重置，模拟一次 render）。 */
function renderCard(fake, Card) {
  fake.reset()
  return Card({})
}

await check('配置卡片：渲染「自动切换」开关 + 「判定阈值」数字框 + 保存按钮', () => {
  const fake = fakeReact()
  const { scope } = fakeScope({ routerEnabled: false, routerThreshold: 0.75 })
  const { Card } = createSettingsCard({ React: fake.React, scope })
  const tree = renderCard(fake, Card)

  const toggle = byId(tree, 'dsh-switch-preset-routerEnabled')
  const threshold = byId(tree, 'dsh-switch-preset-routerThreshold')
  assert.ok(toggle, '必须有自动切换开关（id 稳定，便于定位与无障碍）')
  assert.ok(threshold, '必须有判定阈值数字框')
  assert.equal(toggle.type, 'input')
  assert.equal(toggle.props.type, 'checkbox')
  assert.equal(toggle.props.checked, false, '开关应反映当前值')
  assert.equal(threshold.props.type, 'number')
  assert.equal(threshold.props.value, '0.75', '数字框应反映当前值')
  assert.equal(threshold.props.min, 0)
  assert.equal(threshold.props.max, 1)
  assert.ok(findNode(tree, n => n.type === 'button' && n.children?.[0] === '保存'), '必须有保存按钮')
  assert.ok(findNode(tree, n => n.props?.['data-plugin-config'] === 'dsh-switch-preset'), '容器需带 data-plugin-config 便于定位')
})

await check('配置卡片：保存 → setFields(两个字段并按快照归一化回显) + 成功文案', async () => {
  const fake = fakeReact()
  const { scope, calls } = fakeScope({ routerEnabled: true, routerThreshold: 0.6 })
  const { Card } = createSettingsCard({ React: fake.React, scope })

  let tree = renderCard(fake, Card)
  byId(tree, 'dsh-switch-preset-routerEnabled').props.onChange({ target: { checked: false } })
  byId(tree, 'dsh-switch-preset-routerThreshold').props.onChange({ target: { value: '0.85' } })
  tree = renderCard(fake, Card)

  const save = findNode(tree, n => n.type === 'button' && n.children?.[0] === '保存')
  await save.props.onClick()
  assert.deepEqual(calls.setFields, [{ routerEnabled: false, routerThreshold: 0.85 }],
    '保存必须一次提交两个字段（避免一半成功的中间态）')

  tree = renderCard(fake, Card)
  const notice = findNode(tree, n => n.props?.role === 'status')
  assert.ok(notice && String(notice.children?.[0]).includes('已保存'), '必须给出保存成功文案')
  assert.ok(String(notice.children?.[0]).includes('关闭'), '文案应说明自动切换已关闭')
})

await check('配置卡片：阈值越界 → 前端拦下并给明确文案（不发请求）', async () => {
  const fake = fakeReact()
  const { scope, calls } = fakeScope({ routerEnabled: true, routerThreshold: 0.6 })
  const { Card } = createSettingsCard({ React: fake.React, scope })

  let tree = renderCard(fake, Card)
  byId(tree, 'dsh-switch-preset-routerThreshold').props.onChange({ target: { value: '5' } })
  tree = renderCard(fake, Card)
  assert.equal(byId(tree, 'dsh-switch-preset-routerThreshold').props.value, '5', '越界值如实显示，不偷偷改成默认')

  await findNode(tree, n => n.type === 'button' && n.children?.[0] === '保存').props.onClick()
  assert.equal(calls.setFields.length, 0, '越界值不得发请求')
  tree = renderCard(fake, Card)
  const alert = findNode(tree, n => n.props?.role === 'alert')
  assert.ok(alert && String(alert.children?.[0]).includes('阈值无效'), '必须给出明确文案')
})

await check('配置卡片：保存失败 → 显示服务端原因，且不假报成功', async () => {
  const fake = fakeReact()
  const { scope } = fakeScope({ routerEnabled: true, routerThreshold: 0.6 },
    { failWrite: new Error('阈值超出范围：5（必须在 0–1 之间）') })
  const { Card } = createSettingsCard({ React: fake.React, scope })

  let tree = renderCard(fake, Card)
  await findNode(tree, n => n.type === 'button' && n.children?.[0] === '保存').props.onClick()
  tree = renderCard(fake, Card)
  const alert = findNode(tree, n => n.props?.role === 'alert')
  assert.ok(alert, '失败必须显示错误区')
  assert.ok(String(alert.children?.[0]).includes('保存失败'), '文案要说明是保存失败')
  assert.ok(String(alert.children?.[0]).includes('阈值超出范围'), '必须带出服务端原因')
  assert.equal(findNode(tree, n => n.props?.role === 'status'), undefined, '失败时不得出现成功文案')
})

await check('配置卡片：数据面不可用 → 只读提示（不崩、不误导）', () => {
  const fake = fakeReact()
  const { Card } = createSettingsCard({ React: fake.React, scope: null })
  const tree = renderCard(fake, Card)
  assert.ok(findNode(tree, n => n.props?.['data-plugin-config'] === 'dsh-switch-preset'), '仍要渲染卡片容器')
  assert.equal(byId(tree, 'dsh-switch-preset-routerEnabled'), undefined, '无数据面时不渲染可点控件')
  assert.ok(findNode(tree, n => typeof n.children?.[0] === 'string' && n.children[0].includes('设置服务不可用')),
    '必须给出只读原因')
})

await check('配置卡片：订阅到新 revision 后表单跟随最新值（热同步）', () => {
  const fake = fakeReact()
  const listeners = []
  const snapshot = { status: 'ok', value: { routerEnabled: true, routerThreshold: 0.6 }, revision: 1 }
  const scope = {
    getSnapshot: () => ({ ...snapshot }),
    subscribe: fn => { listeners.push(fn); return () => {} },
    set: async () => {},
    setFields: async () => {},
    unset: async () => {},
  }
  const { Card } = createSettingsCard({ React: fake.React, scope })
  let tree = renderCard(fake, Card)
  fake.mount() // 模拟挂载：跑 effect 里的订阅
  assert.equal(byId(tree, 'dsh-switch-preset-routerThreshold').props.value, '0.6')

  snapshot.value = { routerEnabled: false, routerThreshold: 0.9 }
  snapshot.revision = 2
  for (const fn of listeners) fn()
  tree = renderCard(fake, Card)
  assert.equal(byId(tree, 'dsh-switch-preset-routerThreshold').props.value, '0.9', '新 revision 应同步进表单')
  assert.equal(byId(tree, 'dsh-switch-preset-routerEnabled').props.checked, false)
})

console.log(`\n[settings] ${passed} 项通过` + (process.exitCode ? '（有失败）' : ''))
