import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = name => ts.transpileModule(fs.readFileSync(`src/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/(['"])(?:\.\/|\.\.\/)i18n\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href)).replace(/(['"])react-i18next\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href))
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
const demoUrl = url(source('demoStore'))
const demo = await import(demoUrl)
const apiUrl = url(source('api').replace("'./demoStore'", JSON.stringify(demoUrl)).replace("'axios'", JSON.stringify(new URL('./node_modules/axios/index.js', import.meta.url).href)))
const { default: api } = await import(apiUrl)
const finance = await import(url(source('finance').replace("'./api'", JSON.stringify(apiUrl))))
demo.enableDemoMode()
const folder = (await api.post('/folders', { name: 'Balance QA' })).data
const contact = (await api.post('/contacts', { name: 'Balance QA', folder_id: folder.id })).data
for (const direction of ['they_owe_me', 'i_owe_them']) {
  for (const amounts of [[5], [10], [15], [5, 5, 5], [15, 5]]) {
    const debt = (await api.post('/debts', { contact_id: contact.id, direction, amount: 10, currency: 'TJS' })).data
    let paid = 0
    for (const amount of amounts) {
      await api.post(`/debts/${debt.id}/payments`, { amount })
      paid += amount
      const payments = { [debt.id]: (await api.get(`/debts/${debt.id}/payments`)).data }
      const signed = (direction === 'they_owe_me' ? 1 : -1) * (10 - paid) || 0
      assert.equal(finance.remaining(debt, payments), 10 - paid)
      assert.equal(finance.financialBalance(debt, payments), signed)
      assert.equal(finance.paymentProgress(debt, payments), paid * 10)
      const expected = { theyOwe: signed > 0 ? signed : 0, iOwe: signed < 0 ? -signed : 0, net: signed }
      const records = [debt, { ...debt, id: 'other-currency', currency: 'USD' }]
      assert.deepEqual(finance.totalsForCurrency(records, payments), expected)
      assert.deepEqual(finance.totalsForCurrency(records.filter(item => item.contact_id === contact.id), payments), expected)
      const contacts = new Map([[contact.id, contact]])
      assert.deepEqual(finance.totalsForCurrency(records.filter(item => contacts.get(item.contact_id)?.folder_id === folder.id), payments), expected)
      const recent = finance.recentPayments([debt], payments, [contact])
      assert.equal(recent.every(item => item.debt.direction === direction && item.contact.id === contact.id), true)
      assert.equal(recent.reduce((sum, item) => sum + item.payment.amount, 0), paid)
    }
    await api.delete(`/debts/${debt.id}`)
  }
}
for (const page of ['Contacts', 'Folders']) assert.ok(fs.readFileSync(`src/pages/${page}.tsx`, 'utf8').includes('totalsForCurrency('))
const debtsUi = fs.readFileSync('src/pages/Debts.tsx', 'utf8')
assert.equal(debtsUi.includes('Платёж не может превышать'), false)
assert.equal(debtsUi.includes('debts.filter(debt => remaining(debt, payments) > 0).map'), false)
assert.ok(debtsUi.includes('financialBalance(debt, payments)'))
console.log('PASS: 10+5, 10+10, 10+15, incremental crossing and further payments; both directions; signed balances, progress above 100%, Dashboard/contact/folder totals and currency isolation; recent event direction retained; no payment ceiling or settled-debt exclusion.')
