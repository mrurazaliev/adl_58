import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const source = path => ts.transpileModule(fs.readFileSync(`src/${path}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText.replace(/(['"])(?:\.\/|\.\.\/)i18n\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href)).replace(/(['"])react-i18next\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href))
let mode = 'demo'
const storage = new Map([['owner-session', 'unchanged'], ['adl-react-demo-v2', 'untouched']])
globalThis.localStorage = { getItem: key => key === 'adl-react-data-mode' ? mode : storage.get(key) ?? null, setItem: (key, value) => { if (key === 'adl-react-data-mode') mode = value; else throw Error('Unexpected storage write') } }
globalThis.fetch = () => { throw Error('Unexpected network request') }
globalThis.phase6States = []
globalThis.phase6Index = 0
const hooksUrl = url('export const useState = initial => { const index = globalThis.phase6Index++; if (!(index in globalThis.phase6States)) globalThis.phase6States[index] = initial; return [globalThis.phase6States[index], value => { globalThis.phase6States[index] = typeof value === "function" ? value(globalThis.phase6States[index]) : value }]; };')
const jsxUrl = url('export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;')
const demoUrl = url(source('demoStore.ts'))
const demo = await import(demoUrl)
demo.enableDemoMode()
const apiUrl = url('export default {}; export const ensureArray = value => value;')
const financeUrl = url(source('finance.ts').replace("'./api'", JSON.stringify(apiUrl)))
const syncUrl = url('export default function SyncBanner() {}')
const load = async path => (await import(url(source(path)
  .replace('"react/jsx-runtime"', JSON.stringify(jsxUrl))
  .replace("'react'", JSON.stringify(hooksUrl))
  .replace("'../demoStore'", JSON.stringify(demoUrl))
  .replace("'../finance'", JSON.stringify(financeUrl))
  .replace("'../components/SyncBanner'", JSON.stringify(syncUrl))))).default
const Archive = await load('pages/Archive.tsx')
const Users = await load('pages/Users.tsx')
const render = component => { globalThis.phase6Index = 0; return component() }
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
const textOf = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(textOf).join('') : textOf(tree.props?.children)
const find = (tree, predicate) => { const node = nodes(tree).find(predicate); assert.ok(node, 'Expected control'); return node }
const label = (tree, value) => find(tree, node => node.props?.['aria-label'] === value)
const button = (tree, value) => find(tree, node => node.type === 'button' && textOf(node) === value)
const change = (node, value) => node.props.onChange({ target: { value } })
const rows = tree => nodes(tree).filter(node => node.type === 'tbody').flatMap(node => nodes(node.props.children).filter(child => child.type === 'tr'))
let tree = render(Archive)
assert.equal(rows(tree).length, 3)
assert.ok(textOf(rows(tree)[0]).includes('0%'))
assert.ok(textOf(rows(tree)[0]).includes('Закрыт'))
change(label(tree, 'Сортировка архива'), 'amount')
tree = render(Archive)
assert.ok(textOf(rows(tree)[0]).includes('Пример контакта В'))
change(label(tree, 'Папка архива'), 'none')
tree = render(Archive)
assert.equal(rows(tree).length, 1)
assert.ok(textOf(rows(tree)[0]).includes('Пример контакта Б'))
change(label(tree, 'Папка архива'), 'all')
change(label(tree, 'Контакт архива'), 'archive-sample-1')
tree = render(Archive)
assert.ok(textOf(rows(tree)[0]).includes('Пример контакта А'))
change(label(tree, 'Поиск в архиве'), 'no match')
assert.ok(textOf(render(Archive)).includes('Ничего не найдено'))
globalThis.phase6States = []
tree = render(Users)
assert.equal(rows(tree).length, 5)
button(tree, 'Далее').props.onClick()
tree = render(Users)
assert.equal(rows(tree).length, 1)
assert.ok(textOf(tree).includes('Страница 2 из 2'))
change(label(tree, 'Сортировка пользователей'), 'desc')
tree = render(Users)
assert.ok(textOf(rows(tree)[0]).includes('sample_foxtrot'))
assert.ok(textOf(tree).includes('Страница 1 из 2'))
change(label(tree, 'Строк на странице'), '10')
tree = render(Users)
assert.equal(rows(tree).length, 6)
change(label(tree, 'Поиск пользователей'), 'BRAVO')
tree = render(Users)
assert.equal(rows(tree).length, 1)
assert.ok(textOf(rows(tree)[0]).includes('sample_bravo'))
button(tree, 'Добавить пользователя').props.onClick()
tree = render(Users)
change(find(tree, node => node.type === 'input' && node.props.maxLength === 120), 'sample_new')
tree = render(Users)
find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} })
tree = render(Users)
assert.equal(rows(tree).length, 7)
assert.ok(textOf(tree).includes('sample_new'))
assert.equal(nodes(tree).some(node => node.props?.role === 'dialog'), false)
assert.equal(storage.get('owner-session'), 'unchanged')
assert.equal(storage.get('adl-react-demo-v2'), 'untouched')
mode = 'live'
for (const component of [Archive, Users]) {
  tree = render(component)
  assert.equal(/BACKEND GAP|backend|DEMO|прототип|контракт/.test(textOf(tree)), false)
  assert.equal(nodes(tree).some(node => node.props?.className === 'prototype-notice' || node.props?.className === 'sync-banner'), false)
  assert.equal(textOf(tree).includes('sample_new'), false)
  assert.equal(textOf(tree).includes('Пример контакта А'), false)
  assert.ok(nodes(tree).filter(node => ['button', 'input', 'select'].includes(node.type)).every(node => node.props.disabled))
}
for (const path of ['pages/Archive.tsx', 'pages/Users.tsx']) {
  const code = fs.readFileSync(`src/${path}`, 'utf8')
  assert.equal(/api\.|fetch\(|auth\/register|readDemoState|writeDemoState|localStorage\.(set|remove)/.test(code), false)
}
assert.equal(/paid|closed_at|is_closed|archived/.test(fs.readFileSync('src/pages/Archive.tsx', 'utf8').replace('Closed нельзя подменять статусом paid.', '')), false)
assert.equal(/reports/i.test(fs.readFileSync('src/main.tsx', 'utf8') + fs.readFileSync('src/components/WorkspaceLayout.tsx', 'utf8')), false)
console.log('PASS: Archive sample closed at 0%, search/contact/folder/sort; Users search/sort/page size/pagination/local add; live controls disabled and sample rows hidden; storage unchanged; no API calls or paid-as-closed logic; Reports absent. Controlled JSX event checks, not browser tests.')
