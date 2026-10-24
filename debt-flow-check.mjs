import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createDebtHarness, nodes } from './debt-dialog-harness.mjs'

const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
let contacts=[{id:'existing',name:'Existing Contact'}]
const calls=[]
globalThis.window={dispatchEvent:()=>{}}
globalThis.mockDebtApi={get:async path=>{calls.push(['GET',path]);return {data:[...contacts]}},post:async(path,body)=>{calls.push(['POST',path,body]);if(path==='/contacts'){const contact={id:'created',...body};contacts.push(contact);return {data:contact}}return {data:{id:'debt',status:'pending',...body}}}}
const apiUrl=url('export default globalThis.mockDebtApi; export const getErrorMessage = error => error.message;')
for(const direction of ['they_owe_me','i_owe_them']){
  const flow=await createDebtHarness(apiUrl,direction)
  const options=flow.autocomplete().props.filterOptions(contacts,{inputValue:'isting'})
  assert.equal(options[0].id,'existing')
  flow.autocomplete().props.onChange(null,contacts[0])
  flow.amount(10)
  await flow.save()
  assert.equal(flow.harness.created[0].direction,direction)
  assert.equal(flow.harness.created[0].contact_id,'existing')
  flow.unmount()
}
let flow=await createDebtHarness(apiUrl)
flow.autocomplete().props.onInputChange(null,' New Contact ','input')
const option=flow.autocomplete().props.filterOptions(contacts,{inputValue:' New Contact '}).find(option=>option.createName)
flow.autocomplete().props.onChange(null,option)
assert.equal(calls.filter(call=>call[0]==='POST'&&call[1]==='/contacts').length,0)
flow.cancel()
assert.equal(flow.harness.closed,1)
flow.unmount()
flow=await createDebtHarness(apiUrl)
flow.autocomplete().props.onChange(null,option)
flow.amount(25)
await flow.save()
assert.equal(flow.harness.created[0].contact_id,'created')
assert.deepEqual(calls.find(call=>call[0]==='POST'&&call[1]==='/contacts')[2],{name:'New Contact'})
flow.unmount()
flow=await createDebtHarness(apiUrl)
assert.equal(flow.autocomplete().props.filterOptions(contacts,{inputValue:' new CONTACT '}).some(option=>option.createName),false)
const before=calls.filter(call=>call[0]==='POST'&&call[1]==='/contacts').length
flow.autocomplete().props.onChange(null,{id:'intent',name:' existing contact ',createName:' existing contact '})
flow.amount(5)
await flow.save()
assert.equal(calls.filter(call=>call[0]==='POST'&&call[1]==='/contacts').length,before)
assert.equal(flow.harness.created[0].contact_id,'existing')
flow.unmount()
const saveDisabled = flow => nodes(flow.render()).find(node => node.type === 'button' && node.props.type === 'submit').props.disabled
flow = await createDebtHarness(apiUrl)
flow.amount(10)
assert.equal(saveDisabled(flow), false)
const emptyRequests = calls.length
await flow.save()
assert.equal(calls.length, emptyRequests)
assert.equal(flow.harness.state[5], 'Введите имя контакта.')
flow.autocomplete().props.onInputChange(null, ' Typed only ', 'input')
assert.equal(saveDisabled(flow), false)
for (const amount of ['', 0, -1, 'invalid']) {
  flow.amount(amount)
  assert.equal(saveDisabled(flow), false)
  const requestCount = calls.length
  await flow.save()
  assert.equal(calls.length, requestCount)
  assert.equal(flow.harness.state[5], 'Введите сумму больше нуля.')
}
flow.amount(10)
await flow.save()
assert.equal(flow.harness.created.length, 1)
assert.deepEqual(calls.filter(call => call[0] === 'POST' && call[1] === '/contacts').at(-1)[2], { name: 'Typed only' })
flow.unmount()
flow = await createDebtHarness(apiUrl)
flow.autocomplete().props.onInputChange(null, ' existing CONTACT ', 'input')
flow.amount(10)
const contactPosts = () => calls.filter(call => call[0] === 'POST' && call[1] === '/contacts').length
const contactCount = contactPosts()
await flow.save()
assert.equal(flow.harness.created[0].contact_id, 'existing')
assert.equal(contactPosts(), contactCount)
flow.unmount()
const originalPost = globalThis.mockDebtApi.post
flow = await createDebtHarness(apiUrl)
flow.autocomplete().props.onInputChange(null, 'Failed contact', 'input')
flow.amount(10)
const debtPosts = () => calls.filter(call => call[0] === 'POST' && call[1] === '/debts').length
const debtCount = debtPosts()
globalThis.mockDebtApi.post = async (path, body) => {
  if (path === '/contacts') throw Error('Contact failed')
  return originalPost(path, body)
}
await flow.save()
assert.equal(debtPosts(), debtCount)
assert.equal(flow.harness.created.length, 0)
assert.equal(flow.harness.state[5], 'Contact failed')
assert.equal(saveDisabled(flow), false)
flow.unmount()
flow = await createDebtHarness(apiUrl)
flow.autocomplete().props.onInputChange(null, 'Retry debt', 'input')
flow.amount(10)
globalThis.mockDebtApi.post = async (path, body) => {
  if (path === '/debts') throw Error('Debt failed')
  return originalPost(path, body)
}
await flow.save()
assert.equal(flow.harness.created.length, 0)
assert.equal(flow.harness.state[5], 'Debt failed')
const retryContacts = contactPosts()
globalThis.mockDebtApi.post = originalPost
await flow.save()
assert.equal(flow.harness.created.length, 1)
assert.equal(contactPosts(), retryContacts)
flow.unmount()
assert.ok(fs.readFileSync('src/components/AddDebtDialog.tsx','utf8').includes('disabled={saving}'))
assert.ok(fs.readFileSync('src/components/AddDebtDialog.tsx','utf8').includes('onSubmit={save} noValidate'))
assert.ok(fs.readFileSync('src/pages/Debts.tsx','utf8').includes('useContext(DebtCreationContext)'))
const layout=fs.readFileSync('src/components/WorkspaceLayout.tsx','utf8')
assert.ok(layout.includes("openAddDebt('they_owe_me')")&&layout.includes("openAddDebt('i_owe_them')"))
assert.equal(layout.match(/role="menuitem"/g).length,2)
console.log('PASS: shared debt dialog, two FAB directions, typed-only name save eligibility, invalid/empty/zero amounts, selected and typed existing-contact matching, new-contact creation, failed contact blocks debt, failed debt retains contact for retry, duplicate recheck and cancel without writes. Controlled handler tests; browser keyboard/visuals unverified.')
