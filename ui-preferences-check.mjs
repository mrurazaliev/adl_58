import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

await Promise.all(['@mui/material/IconButton', '@mui/material/Tooltip', '@mui/icons-material/DarkMode', '@mui/icons-material/LightMode'].map(name => import(name)))

const source = path => ts.transpileModule(fs.readFileSync(`src/${path}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const storage = new Map([['adl-react-data-mode', 'demo'], ['adl-react-demo-v2', JSON.stringify({ contacts: [{ name: 'Мне должны', note: 'Do not translate me' }], payments: [15] })]])
const originalData = storage.get('adl-react-demo-v2')
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
globalThis.document = { documentElement: { lang: '', dataset: {}, style: {} } }
const translationsUrl = url(source('translations.ts'))
const { messages } = await import(translationsUrl)
const i18nCode = source('i18n.ts').replace("'./translations'", JSON.stringify(translationsUrl)).replace("'i18next'", JSON.stringify(import.meta.resolve('i18next'))).replace("'react-i18next'", JSON.stringify(import.meta.resolve('react-i18next')))
const i18nUrl = url(i18nCode)
const { default: i18n, locale } = await import(i18nUrl)
const themeCode = source('theme.ts')
const themeUrl = url(themeCode)
const theme = await import(themeUrl)
const apiStub = url('export default {}; export const ensureArray = value => value;')
const financeUrl = url(source('finance.ts').replace("'./i18n'", JSON.stringify(i18nUrl)).replace("'./api'", JSON.stringify(apiStub)))
const finance = await import(financeUrl)
const resolveReact = code => code.replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace("'react-i18next'", JSON.stringify(import.meta.resolve('react-i18next'))).replace("'react'", JSON.stringify(import.meta.resolve('react'))).replace(/(['"])(@mui\/[^'"]+)\1/g, (_, quote, name) => JSON.stringify(import.meta.resolve(name)))
const { default: SummaryCards } = await import(url(resolveReact(source('components/SummaryCards.tsx')).replace("'../finance'", JSON.stringify(financeUrl))))
const { default: AppearanceControls } = await import(url(resolveReact(source('components/AppearanceControls.tsx')).replace("'../theme'", JSON.stringify(themeUrl))))
const debt = { id: 'balance', contact_id: 'contact', direction: 'they_owe_me', amount: 10, currency: 'TJS' }
const payments = { balance: [{ id: 'payment', amount: 15 }] }
const expectedLabels = { ru: ['Чистый итог', 'Мне должны', 'Я должен'], tg: ['Бақияи холис', 'Ба ман қарздоранд', 'Ман қарздорам'], en: ['Net total', 'They owe me', 'I owe'] }
for (const language of ['ru', 'tg', 'en']) {
  await i18n.changeLanguage(language)
  assert.equal(storage.get('adl-language'), language)
  assert.equal(document.documentElement.lang, language)
  const totals = finance.totalsForCurrency([debt], payments)
  assert.deepEqual(totals, { theyOwe: 0, iOwe: 5, net: -5 })
  const html = renderToStaticMarkup(React.createElement(SummaryCards, totals))
  for (const label of expectedLabels[language]) assert.ok(html.includes(label))
  const controls = renderToStaticMarkup(React.createElement(AppearanceControls))
  assert.ok(controls.includes(`value="${language}" selected=""`))
  assert.equal(i18n.t('Удалить контакт «{{v0}}»?', { v0: 'Мне должны' }).includes('Мне должны'), true)
  assert.equal(storage.get('adl-react-demo-v2'), originalData)
  assert.equal(storage.get('adl-react-data-mode'), 'demo')
  assert.equal(finance.remaining(debt, payments), -5)
  assert.equal(finance.paymentProgress(debt, payments), 150)
  assert.ok(['ru-RU', 'tg-TJ', 'en-US'].includes(locale()))
}
for (const selection of ['dark', 'light']) {
  theme.setTheme(selection)
  assert.equal(theme.getTheme(), selection)
  assert.equal(storage.get('adl-theme'), selection)
  assert.equal(document.documentElement.dataset.theme, selection)
  assert.equal(document.documentElement.style.colorScheme, selection)
  const controls = renderToStaticMarkup(React.createElement(AppearanceControls))
  assert.equal((controls.match(/<button\b/g) || []).length, 1)
  assert.equal((controls.match(/<select\b/g) || []).length, 1)
  assert.ok(controls.includes(selection === 'dark' ? 'LightModeIcon' : 'DarkModeIcon'))
  assert.ok(controls.includes(`aria-label="${i18n.t(selection === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему')}"`))
  assert.deepEqual(finance.totalsForCurrency([debt], payments), { theyOwe: 0, iOwe: 5, net: -5 })
  assert.equal(storage.get('adl-react-demo-v2'), originalData)
}
assert.equal((await import(themeUrl + '#reload')).getTheme(), 'light')
await import(i18nUrl + '#reload')
assert.equal(i18n.resolvedLanguage, 'en')
globalThis.uiTestI18n = i18n
globalThis.uiTestThemeState = undefined
const stateHooks = url('export const useState = initial => { if (globalThis.uiTestThemeState === undefined) globalThis.uiTestThemeState = initial(); return [globalThis.uiTestThemeState, value => { globalThis.uiTestThemeState = value }]; };')
const languageHooks = url('export const useTranslation = () => ({ t: globalThis.uiTestI18n.t.bind(globalThis.uiTestI18n), i18n: globalThis.uiTestI18n });')
const jsxObjects = url('export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;')
const muiStub = name => url(`export default function ${name}() {}`)
const controlledSource = source('components/AppearanceControls.tsx')
  .replace('"react/jsx-runtime"', JSON.stringify(jsxObjects))
  .replace("'react'", JSON.stringify(stateHooks))
  .replace("'react-i18next'", JSON.stringify(languageHooks))
  .replace("'../theme'", JSON.stringify(themeUrl))
  .replace(/(['"])(@mui\/[^'"]+)\1/g, (_, quote, name) => JSON.stringify(muiStub(name.split('/').pop())))
const { default: Controls } = await import(url(controlledSource))
for (const language of ['ru', 'tg', 'en']) {
  await Controls().props.children[0].props.onChange({ target: { value: language } })
  assert.equal(Controls().props.children[0].props.value, language)
  assert.equal(storage.get('adl-language'), language)
}
for (const language of ['ru', 'tg', 'en']) {
  await i18n.changeLanguage(language)
  for (const selection of ['dark', 'light']) {
    theme.setTheme(selection)
    globalThis.uiTestThemeState = undefined
    const tooltip = Controls().props.children[1]
    const button = tooltip.props.children
    const label = i18n.t(selection === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему')
    assert.equal(tooltip.props.title, label)
    assert.equal(button.props['aria-label'], label)
    assert.equal(button.props.children.type.name, selection === 'dark' ? 'LightMode' : 'DarkMode')
    button.props.onClick()
    assert.equal(storage.get('adl-theme'), selection === 'dark' ? 'light' : 'dark')
    assert.equal(storage.get('adl-react-demo-v2'), originalData)
    globalThis.uiTestThemeState = undefined
    assert.equal(Controls().props.children[1].props.children.props.children.type.name, selection === 'dark' ? 'DarkMode' : 'LightMode')
  }
}
const files = [...fs.readdirSync('src/pages').map(name => `src/pages/${name}`), ...fs.readdirSync('src/components').map(name => `src/components/${name}`), 'src/main.tsx']
const missing = []
for (const file of files) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const key = node.arguments[0].text
      if (!messages[key]) missing.push(`${file}: ${key}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
}
assert.deepEqual(missing, [])
for (const [key, values] of Object.entries(messages)) {
  assert.equal(values.length, 2)
  assert.ok(values.every(value => typeof value === 'string' && value.length > 0), key)
  const slots = value => [...value.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort()
  for (const value of values) assert.deepEqual(slots(value), slots(key), key)
}
const css = fs.readFileSync('src/index.css', 'utf8')
assert.ok(css.includes(':root[data-theme="light"]'))
assert.ok(css.includes('--surface: #ffffff'))
assert.ok(css.includes('--surface: #151817'))
const rgb = color => {
  if (color.startsWith('#')) {
    const value = color.slice(1)
    return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
  }
  const [hue, saturation, lightness] = color.match(/[\d.]+/g).map(Number)
  const h = hue / 60, s = saturation / 100, l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2
  const channels = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  return channels.map(value => value + m)
}
const luminance = color => rgb(color).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
const lightPalette = css.split(':root[data-theme="light"] {')[1].split('}')[0]
for (const color of ['61c985', 'e06b67', '929a96']) {
  const lightColor = lightPalette.match(new RegExp(`--tone-${color}: ([^;]+);`))[1]
  for (const [foreground, background] of [[`#${color}`, '#151817'], [lightColor, '#ffffff']]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `Text contrast: ${foreground} on ${background}`)
  }
}
assert.equal(/prefers-color-scheme/.test(css + themeCode), false)
assert.equal(/reports/i.test(fs.readFileSync('src/main.tsx', 'utf8') + fs.readFileSync('src/components/WorkspaceLayout.tsx', 'utf8')), false)
console.log(`PASS: real i18next RU→TG→EN, translated React summary/control renders, complete ${Object.keys(messages).length}-key catalog and interpolation parity; language/theme persistence and reinitialization; both themes; unchanged application data; signed balance/progress retained; Reports absent. Browser interaction/visual QA remains separate.`)
