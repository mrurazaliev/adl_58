import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import axios from 'axios'

const source = name => ts.transpileModule(fs.readFileSync(`src/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/(['"])(?:\.\/|\.\.\/)i18n\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href)).replace(/(['"])react-i18next\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href))
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
let liveCalls = 0
let releaseResponse
axios.defaults.adapter = config => {
  liveCalls++
  return new Promise(resolve => { releaseResponse = () => resolve({ data: [], status: 200, headers: {}, config }) })
}
const demoUrl = url(source('demoStore'))
const demo = await import(demoUrl)
storage.set('adl-react-data-mode', 'demo')
assert.equal(demo.isDemoMode(), false)
const apiModule = await import(url(source('api').replace("'./demoStore'", JSON.stringify(demoUrl)).replace("'axios'", JSON.stringify(new URL('./node_modules/axios/index.js', import.meta.url).href))))
const api = apiModule.default
demo.enableDemoMode()
const folder = (await api.post('/folders', { name: 'QA', color: '#123456' })).data
const contact = (await api.post('/contacts', { name: 'QA', folder_id: folder.id })).data
await api.patch(`/contacts/${contact.id}`, { name: 'QA edited', phone: '123' })
assert.equal((await api.get('/contacts')).data.find(item => item.id === contact.id).phone, '123')
await api.patch(`/folders/${folder.id}`, { name: 'QA edited' })
assert.equal((await api.get('/folders')).data.find(item => item.id === folder.id).name, 'QA edited')
const debt = (await api.post('/debts', { contact_id: contact.id, direction: 'they_owe_me', amount: 100, currency: 'TJS' })).data
await api.patch(`/debts/${debt.id}`, { amount: 120 })
await api.post(`/debts/${debt.id}/payments`, { amount: 20 })
assert.equal(demo.readDemoState().debts.find(item => item.id === debt.id).status, 'partial')
await assert.rejects(api.post(`/debts/${debt.id}/payments`, { amount: 0 }))
await api.post(`/debts/${debt.id}/payments`, { amount: 100 })
assert.equal(demo.readDemoState().debts.find(item => item.id === debt.id).status, 'paid')
await api.delete(`/folders/${folder.id}`)
assert.equal(demo.readDemoState().contacts.find(item => item.id === contact.id).folder_id, null)
await api.delete(`/debts/${debt.id}`)
assert.equal(demo.readDemoState().payments[debt.id], undefined)
const linked = (await api.post('/debts', { contact_id: contact.id, direction: 'i_owe_them', amount: 10, currency: 'TJS' })).data
await api.delete(`/contacts/${contact.id}`)
assert.equal(demo.readDemoState().debts.some(item => item.id === linked.id), false)
const saved = storage.get('adl-react-demo-v2')
demo.disableDemoMode()
demo.enableDemoMode()
assert.equal(storage.get('adl-react-demo-v2'), saved)
for (const bad of ['null', '{}', '{', JSON.stringify({ contacts: [null], folders: [], debts: [], payments: {} }), JSON.stringify({ ...JSON.parse(saved), payments: { sample: null } })]) {
  storage.set('adl-react-demo-v2', bad)
  await assert.rejects(api.get('/contacts'), /demo/i)
  assert.equal(storage.get('adl-react-demo-v2'), bad)
}
storage.set('adl-react-demo-v2', saved)
assert.throws(() => apiModule.ensureArray([null], 'QA'))
assert.throws(() => apiModule.ensureArray({}, 'QA'))
assert.equal(typeof apiModule.getErrorMessage(new axios.AxiosError('Request failed', undefined, undefined, undefined, { status: 422, data: { error: { detail: 'bad' } } })), 'string')
const controller = new AbortController()
controller.abort()
await assert.rejects(api.get('/contacts', controller.signal))
assert.equal(liveCalls, 0)
demo.disableDemoMode()
const pending = api.get('/contacts')
demo.enableDemoMode()
releaseResponse()
await assert.rejects(pending, /Режим данных/)
assert.equal(liveCalls, 1)
console.log('PASS: reconstructed Phase 4 Contacts/Folders/Debts CRUD, payments, cascades, mode persistence, malformed storage preservation, non-array/null guard, error-message safety, cancellation and stale-live-response rejection. All live responses mocked; no network.')
