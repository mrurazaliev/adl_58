import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import axios from 'axios'
import { EventEmitter } from 'node:events'
import worker from './worker.mjs'
import { devGateway } from './dev-gateway.mjs'

const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const source = name => ts.transpileModule(fs.readFileSync(`src/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/(['"])(?:\.\/|\.\.\/)i18n\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href)).replace(/(['"])react-i18next\1/g, JSON.stringify(new URL('./test-ui-support.mjs', import.meta.url).href))
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
let responseData
let status = 200
let rejectStatus = false
let lastRequest
axios.defaults.adapter = async config => {
  lastRequest = config
  const response = { data: responseData, status, headers: {}, config }
  if (rejectStatus) throw new axios.AxiosError('HTTP failure', undefined, config, undefined, response)
  return response
}
const demoUrl = url(source('demoStore'))
const demo = await import(demoUrl)
const apiUrl = url(source('api').replace("'./demoStore'", JSON.stringify(demoUrl)).replace("'axios'", JSON.stringify(new URL('./node_modules/axios/index.js', import.meta.url).href)))
const { default: api, getErrorMessage } = await import(apiUrl)
const finance = await import(url(source('finance').replace("'./api'", JSON.stringify(apiUrl))))
const state = demo.readDemoState()
storage.set('adl-react-data-mode', 'demo')
for (const [path, values] of [['/contacts', state.contacts], ['/folders', state.folders], ['/debts', state.debts], [`/debts/${state.debts[1].id}/payments`, state.payments[state.debts[1].id]]]) {
  responseData = values
  assert.deepEqual((await api.get(path)).data, values)
  assert.equal(lastRequest.baseURL, '/api')
  assert.equal(lastRequest.headers.Authorization, undefined)
  responseData = values[0]
  status = 201
  assert.deepEqual((await api.post(path, {})).data, values[0])
  if (!path.endsWith('payments')) {
    status = 200
    assert.deepEqual((await api.patch(`${path}/${values[0].id}`, {})).data, values[0])
    status = 204
    responseData = ''
    await api.delete(`${path}/${values[0].id}`)
  }
  status = 200
  for (const malformed of [null, {}, '<html>error</html>', [null], [{}], [{ ...values[0], id: 5 }]]) {
    responseData = malformed
    await assert.rejects(api.get(path), /формат/)
  }
  responseData = { message: 'ok' }
  await assert.rejects(api.post(path, {}), /могло сохраниться/)
}
const user = { id: 'qa-user', name: 'QA', email: 'qa@example.invalid' }
const paymentDebt = state.debts[1]
const paymentRecord = state.payments[paymentDebt.id][0]
responseData = { payment: paymentRecord, debt: paymentDebt }
status = 201
assert.deepEqual((await api.post(`/debts/${paymentDebt.id}/payments`, {})).data, paymentRecord)
responseData = { payment: paymentRecord, debt: { ...paymentDebt, id: 'wrong-debt' } }
await assert.rejects(api.post(`/debts/${paymentDebt.id}/payments`, {}), /могло сохраниться/)
status = 200
responseData = { user }
assert.deepEqual((await api.session()).data.user, user)
await api.register('QA', 'qa@example.invalid', 'mock-registration-password')
assert.equal(lastRequest.url, '/auth/register')
assert.deepEqual(Object.keys(JSON.parse(lastRequest.data)).sort(), ['email', 'name', 'password'])
demo.enableDemoMode()
await api.login('qa@example.invalid', 'test-only-not-a-real-password')
assert.equal(demo.isDemoMode(), false)
assert.equal(lastRequest.url, '/auth/login')
responseData = { ...user, name: 'Changed' }
assert.equal((await api.updateProfile('Changed')).data.name, 'Changed')
assert.deepEqual(JSON.parse(lastRequest.data), { name: 'Changed' })
responseData = { message: 'Logged out' }
await api.logout()
assert.equal(lastRequest.url, '/auth/logout')
for (const errorStatus of [401, 404, 409, 422, 503]) {
  rejectStatus = true
  status = errorStatus
  responseData = { error: { details: 'not renderable' } }
  await assert.rejects(api.get('/contacts'), error => typeof getErrorMessage(error) === 'string' && !getErrorMessage(error).includes('[object Object]'))
}
rejectStatus = false
status = 204
responseData = ''
await assert.rejects(api.post('/debts', {}), /могло сохраниться/)
status = 200
const totals = finance.totalsForCurrency(state.debts, state.payments)
assert.deepEqual(totals, { theyOwe: 3350, iOwe: 800, net: 2550 })
assert.equal(finance.recentPayments(state.debts, state.payments, state.contacts)[0].contact.name, state.contacts[1].name)
assert.ok(getErrorMessage(new axios.AxiosError('Network Error', undefined, { method: 'post' })).includes('могло сохраниться'))
assert.equal(getErrorMessage(new axios.AxiosError('Network Error', undefined, { method: 'get' })), 'Network Error')

const calls = []
globalThis.fetch = async (input, options) => {
  calls.push({ path: new URL(input).pathname, ...options })
  if (new URL(input).pathname === '/api/auth/refresh') return new Response(JSON.stringify({ accessToken: 'test-access', refreshToken: 'test-refresh' }))
  if (options.headers.authorization !== 'Bearer test-access') return new Response('{}', { status: 401 })
  return new Response(JSON.stringify(user))
}
let response = await worker.fetch(new Request('https://qa.invalid/api/auth/session', { headers: { cookie: 'adl_accessToken=old; adl_refreshToken=old-refresh' } }), {})
assert.equal(response.status, 200)
assert.deepEqual(await response.json(), { user })
assert.ok(response.headers.get('set-cookie').includes('HttpOnly'))
assert.ok(response.headers.get('set-cookie').includes('Secure'))
assert.equal(calls.filter(call => call.path === '/api/auth/refresh').length, 1)
assert.equal(calls.length, 3)
assert.equal(calls[0].path, '/api/users/me')
let middleware
devGateway().configureServer({ middlewares: { use: (mount, handler) => { assert.equal(mount, '/api'); middleware = handler } } })
const runDev = async (path, method = 'GET', origin) => {
  const request = new EventEmitter()
  Object.assign(request, { url: path.slice(4), originalUrl: path, method, headers: { host: 'localhost:5173', cookie: 'adl_accessToken=test-access', ...(origin ? { origin } : {}) } })
  const headers = {}
  const response = { statusCode: 200, setHeader: (key, value) => { headers[key] = value }, end: body => { response.body = body } }
  await middleware(request, response)
  return response
}
response = await runDev('/api/auth/session')
assert.equal(response.statusCode, 200)
assert.deepEqual(JSON.parse(response.body), { user })
response = await runDev('/api/contacts', 'DELETE', 'https://other.invalid')
assert.equal(response.statusCode, 403)
console.log('PASS: live-mode same-origin wrapper CRUD/payment/session/profile/logout routing; response validation and malformed mutation replies; 401/404/409/422/503; 204 handling; gateway refresh HttpOnly cookies and no JWT in session body; mounted dev path/origin protection. All upstream responses mocked. Live CRUD NOT verified.')
