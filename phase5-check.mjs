import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const source = name => ts.transpileModule(fs.readFileSync(`src/${name}`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText.replace(/(['"])(?:\.\/|\.\.\/)i18n\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href)).replace(/(['"])react-i18next\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href))
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
const demoUrl = url(source('demoStore.ts'))
const demo = await import(demoUrl)
const apiUrl = url(source('api.ts').replace("'./demoStore'", JSON.stringify(demoUrl)).replace("'axios'", JSON.stringify(new URL('./node_modules/axios/index.js', import.meta.url).href)))
const { default: api } = await import(apiUrl)
const financeUrl = url(source('finance.ts').replace("'./api'", JSON.stringify(apiUrl)))
const finance = await import(financeUrl)
demo.enableDemoMode()
const load = async () => {
  const debts = (await api.get('/debts')).data
  return { debts, contacts: (await api.get('/contacts')).data, payments: await finance.loadPayments(debts) }
}
let state = await load()
assert.deepEqual(finance.totalsForCurrency(state.debts, state.payments), { theyOwe: 3350, iOwe: 800, net: 2550 })
const receivable = state.debts.find(debt => debt.amount === 2500)
await api.post(`/debts/${receivable.id}/payments`, { amount: 500 })
state = await load()
assert.deepEqual(finance.totalsForCurrency(state.debts, state.payments), { theyOwe: 2850, iOwe: 800, net: 2050 })
await api.post(`/debts/${receivable.id}/payments`, { amount: 2000 })
const payable = state.debts.find(debt => debt.direction === 'i_owe_them')
await api.post(`/debts/${payable.id}/payments`, { amount: 800 })
state = await load()
assert.deepEqual(finance.totalsForCurrency(state.debts, state.payments), { theyOwe: 850, iOwe: 0, net: 850 })
await api.patch(`/debts/${receivable.id}`, { created_at: '2025-12-31T23:59:59Z' })
await api.patch(`/debts/${payable.id}`, { created_at: '2026-01-01T00:00:00Z' })
const usd = (await api.post('/debts', { contact_id: state.contacts[0].id, direction: 'they_owe_me', amount: 9999, currency: 'USD', created_at: '2026-01-01T00:00:00Z' })).data
await api.post(`/debts/${usd.id}/payments`, { amount: 10 })
state = await load()
assert.deepEqual(finance.totalsForCurrency(state.debts, state.payments), { theyOwe: 850, iOwe: 0, net: 850 })
const months2025 = finance.monthlyDebtOverview(state.debts, 2025)
const months2026 = finance.monthlyDebtOverview(state.debts, 2026)
assert.equal(months2025.length, 12)
assert.deepEqual(months2025[11], { theyOwe: 2500, iOwe: 0 })
assert.deepEqual(months2026[0], { theyOwe: 0, iOwe: 1200 })
assert.equal(finance.monthlyDebtOverview(state.debts, 1900).every(month => month.theyOwe === 0 && month.iOwe === 0), true)
assert.equal(finance.monthlyDebtOverview([{ ...receivable, created_at: 'invalid' }], 2026).every(month => month.theyOwe === 0), true)
const dates = ['2026-03-01T10:00:00Z', '2026-01-01T10:00:00Z', '2026-02-01T10:00:00Z', '2026-04-01T10:00:00Z', '2026-05-01T10:00:00Z']
Object.values(state.payments).flat().forEach((payment, index) => { payment.paid_at = dates[index] })
const recent = finance.recentPayments(state.debts, state.payments, state.contacts)
assert.deepEqual(recent.map(item => item.payment.paid_at), [...dates].sort().reverse())
assert.equal(recent.every(item => item.contact.id === item.debt.contact_id), true)
assert.equal(recent.some(item => item.debt.currency === 'USD' && item.payment.amount === 10), true)
assert.equal(finance.recentPayments(state.debts, state.payments, state.contacts, 2).length, 2)
assert.equal(finance.recentPayments([], {}, []).length, 0)

const jsxUrl = JSON.stringify(new URL('./node_modules/react/jsx-runtime.js', import.meta.url).href)
const summaryUrl = url(source('components/SummaryCards.tsx').replace('"react/jsx-runtime"', jsxUrl).replace("'../finance'", JSON.stringify(financeUrl)))
const skeletonUrl = url(source('components/ContentSkeleton.tsx').replace('"react/jsx-runtime"', jsxUrl).replace("'@mui/material/Skeleton'", JSON.stringify(import.meta.resolve('@mui/material/Skeleton'))))
const hooksUrl = url('export const useState = value => [globalThis.dashboardTestState.shift() ?? value, () => {}]; export const useMemo = fn => fn(); export const useEffect = () => {}; export const useRef = value => ({ current: value });')
const dashboardUrl = url(source('pages/Dashboard.tsx')
  .replace("'../components/ContentSkeleton'", JSON.stringify(skeletonUrl))
  .replace("'react-router-dom'", JSON.stringify(url('export const useOutletContext = () => null;')))
  .replace('"react/jsx-runtime"', jsxUrl)
  .replace("'react'", JSON.stringify(hooksUrl))
  .replace("'../components/SummaryCards'", JSON.stringify(summaryUrl))
  .replace("'../api'", JSON.stringify(apiUrl))
  .replace("'../finance'", JSON.stringify(financeUrl)))
const { default: Dashboard } = await import(dashboardUrl)
const render = (year, loading = false, error = '') => {
  globalThis.dashboardTestState = [state.debts, state.contacts, state.payments, year, loading, error]
  return renderToStaticMarkup(React.createElement(Dashboard))
}
for (const year of [2025, 2026]) {
  const html = render(year)
  assert.equal((html.match(/class="summary-card /g) || []).length, 3)
  assert.ok(html.indexOf('Чистый итог') < html.indexOf('Мне должны'))
  assert.ok(html.indexOf('Мне должны') < html.indexOf('Я должен'))
  assert.ok(html.includes(`value="${year}" selected=""`))
  assert.ok(html.includes(`Обзор долгов за ${year}`))
  assert.ok(html.includes('Последние платежи'))
  assert.ok(html.includes('Получено') && html.includes('Выплачено'))
  for (const excluded of ['Active Debts', 'Upcoming', 'Recent debts', 'Добавить долг', '<table', '<rect', 'chart-placeholder']) assert.equal(html.includes(excluded), false)
}
assert.ok(render(2026, true).includes('role="status"'))
assert.equal(render(2026, true, 'Test failure').includes('MuiSkeleton-root'), false)
assert.ok(render(2026, true, 'Test failure').includes('aria-busy="false"'))
assert.ok(render(2026, false, 'Test failure').includes('Повторить'))
state = { debts: [], contacts: [], payments: {} }
assert.ok(render(2026).includes('Платежей пока нет'))
assert.ok(render(2026).includes('За 2026 год нет долгов'))
console.log('PASS: demo totals; partial/full payments in both directions; currency isolation; 2025/2026 chart boundaries; empty/invalid dates; recent payment joins/order/limit; controlled Dashboard markup, three cards, year selection, loading/error/empty states and excluded blocks. No live requests.')
