import assert from 'node:assert/strict'
import { makeUi } from '../src/client/ui.ts'

const state = []
let cursor = 0
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(initial) {
    const index = cursor++
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
  },
  useEffect() {},
}
const Menu = Symbol('DSH Menu')
const calls = []
const { ModePickerButton } = makeUi({ React, Menu, picker: {
  fetchPresets: async () => ({ presets: [{ id: 'engineering', name: '工程模式', description: '构建与验证', isDefault: true },
    { id: 'broken', broken: 'invalid' }], modeSelectionEnabled: true }),
  executeSwitch: async (...args) => { calls.push(args) },
} })
const render = () => { cursor = 0; return ModePickerButton({ sessionId: 'test-session' }) }
const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of node.children?.flat(Infinity) ?? []) {
    const result = find(child, predicate)
    if (result) return result
  }
}
let tree = render()
let menu = find(tree, node => node.type === Menu)
assert.ok(menu, 'Preset picker must use the native DSH Menu for themed, viewport-contained placement')
assert.equal(menu.props.side, 'top')
assert.equal(menu.props.align, 'end')
assert.equal(menu.props.portal, true)
menu.props.anchor.props.onClick()
await new Promise(resolve => setImmediate(resolve))
menu = find(render(), node => node.type === Menu)
assert.equal(menu.props.open, true)
assert.equal(menu.props.items.find(item => item.id === 'broken').disabled, true)
await menu.props.onSelect('engineering')
assert.deepEqual(calls, [['test-session', 'engineering']])
assert.equal(find(render(), node => node.type === Menu).props.open, false)
console.log('PASS native preset menu placement, roster, disabled rows, selection and dismissal')
