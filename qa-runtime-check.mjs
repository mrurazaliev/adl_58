import fs from 'node:fs'
import http from 'node:http'
import { parseEnv } from 'node:util'
import ts from 'typescript'
import axios from 'axios'
import gateway from './api/gateway.js'
import { createDebtHarness } from './debt-dialog-harness.mjs'

if (!process.argv.includes('--run-authorized-qa')) { console.log('Requires explicit disposable-account authorization and --run-authorized-qa.'); process.exit(1) }
const result={run:`ADL-QA-${Date.now()}`,checks:[],requests:[],cleanup:[],failures:[]}
const owned={debts:new Set(),contacts:new Set(),folders:new Set()}
const cookies=new Map()
let api, server, ownerId, originalName, profileChanged=false, stage='configuration'
const save=()=>fs.writeFileSync('qa-runtime-result.json',JSON.stringify(result,null,2))
const check=(condition,code)=>{if(!condition)throw Error(code)}
const pass=name=>{result.checks.push(name);save();console.log(`PASS: ${name}`)}
const url=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
try{
  const env=parseEnv(fs.readFileSync('.env.local','utf8'))
  check(Boolean(env.QA_EMAIL&&env.QA_PASSWORD),'MISSING_QA_CONFIGURATION')
  server=http.createServer(gateway)
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const base=`http://127.0.0.1:${server.address().port}`
  axios.defaults.adapter=async config=>{
    const path=config.url, method=config.method.toUpperCase(), parts=path.split('/').filter(Boolean)
    if(method!=='GET'&&!['/auth/login','/auth/logout'].includes(path)){
      check(Boolean(ownerId),'QA_IDENTITY_REQUIRED')
      if(['PATCH','DELETE'].includes(method)&&owned[parts[0]])check(owned[parts[0]].has(parts[1]),'NON_TEST_MUTATION_BLOCKED')
      if(parts[2]==='payments')check(owned.debts.has(parts[1]),'NON_TEST_PAYMENT_BLOCKED')
    }
    const response=await fetch(base+'/api/gateway?path='+path.slice(1),{method,headers:{origin:base,'content-type':'application/json',cookie:[...cookies].map(([key,value])=>`${key}=${value}`).join('; ')},body:method==='GET'?undefined:config.data,redirect:'error',signal:AbortSignal.timeout(35000)})
    for(const cookie of response.headers.getSetCookie()){
      check(cookie.includes('HttpOnly'),'COOKIE_PROTECTION_REQUIRED')
      const pair=cookie.split(';')[0],index=pair.indexOf('='),key=pair.slice(0,index),value=pair.slice(index+1)
      if(value)cookies.set(key,value);else cookies.delete(key)
    }
    const data=response.status===204?null:await response.json().catch(()=>null)
    result.requests.push({method,path:path.replace(/[a-f0-9]{8}-[a-f0-9-]+/gi,'{id}'),status:response.status})
    if(method==='POST'&&parts.length===1&&owned[parts[0]]&&response.ok&&typeof data?.id==='string')owned[parts[0]].add(data.id)
    save()
    const output={data,status:response.status,headers:{},config}
    if(!response.ok)throw new axios.AxiosError('QA_HTTP_FAILURE',undefined,config,undefined,output)
    if(path==='/auth/login'||path==='/auth/session'){
      check(data?.user?.email===env.QA_EMAIL,'QA_ACCOUNT_MISMATCH')
      if(ownerId)check(data.user.id===ownerId,'QA_OWNER_MISMATCH')
    }
    return output
  }
  const source=name=>ts.transpileModule(fs.readFileSync(`src/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/(['"])(?:\.\/|\.\.\/)i18n\1/g,JSON.stringify(new URL('./test-ui-support.mjs',import.meta.url).href))
  const store=new Map([['adl-react-data-mode','demo']])
  globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))}
  globalThis.window={dispatchEvent:()=>{}}
  const demoUrl=url(source('demoStore'))
  const apiUrl=url(source('api').replace("'./demoStore'",JSON.stringify(demoUrl)).replace("'axios'",JSON.stringify(import.meta.resolve('axios'))))
  api=(await import(apiUrl)).default
  const finance=await import(url(source('finance').replace("'./api'",JSON.stringify(apiUrl))))
  stage='unauthenticated session'
  let unauthorized=false
  try{await api.session()}catch(error){unauthorized=error.response?.status===401}
  check(unauthorized,'SESSION_EXPECTED_401')
  stage='login/session'
  await api.login(env.QA_EMAIL,env.QA_PASSWORD)
  const session=(await api.session()).data.user
  ownerId=session.id;originalName=session.name
  pass('QA login/session through Vercel adapter; persisted demo flag does not select demo data')
  const snapshot=async()=>{
    const debts=(await api.get('/debts')).data,contacts=(await api.get('/contacts')).data,payments=await finance.loadPayments(debts)
    return {debts,contacts,payments,totals:finance.totalsForCurrency(debts,payments)}
  }
  const baseline=await snapshot(),expected=new Map()
  stage='folder/contact CRUD'
  const folder=(await api.post('/folders',{name:result.run,color:'#c58a3a'})).data
  await api.patch(`/folders/${folder.id}`,{name:result.run+'-edited'})
  const contact=(await api.post('/contacts',{name:result.run,folder_id:folder.id})).data
  await api.patch(`/contacts/${contact.id}`,{name:result.run+'-edited',note:'Disposable QA'})
  pass('Name-only-supported Contacts contract plus Contact/Folder create/update/read')
  const verifyTotals=async()=>{
    const state=await snapshot()
    let receivable=0,payable=0
    for(const value of expected.values()){
      const signed=(value.direction==='they_owe_me'?1:-1)*(value.amount-value.paid)
      if(signed>0)receivable+=signed;else payable-=signed
    }
    check(Math.abs(state.totals.theyOwe-baseline.totals.theyOwe-receivable)<.001,'DASHBOARD_RECEIVABLE_MISMATCH')
    check(Math.abs(state.totals.iOwe-baseline.totals.iOwe-payable)<.001,'DASHBOARD_PAYABLE_MISMATCH')
    check(Math.abs(state.totals.net-baseline.totals.net-receivable+payable)<.001,'DASHBOARD_NET_MISMATCH')
    return state
  }
  const addThroughForm=async(direction,option,amount)=>{
    const flow=await createDebtHarness(apiUrl,direction)
    flow.autocomplete().props.onChange(null,option)
    flow.amount(amount)
    await flow.save()
    check(flow.harness.created.length===1,'SHARED_FORM_CREATION_FAILED')
    const debt=flow.harness.created[0]
    check(debt.direction===direction,'DIRECTION_MISMATCH')
    expected.set(debt.id,{direction,amount,paid:0})
    flow.unmount()
    return debt
  }
  stage='shared form existing contacts and both directions'
  const first=await addThroughForm('they_owe_me',{...contact,name:result.run+'-edited'},10)
  const second=await addThroughForm('i_owe_them',{...contact,name:result.run+'-edited'},10)
  pass('Shared form existing-contact creation for both FAB directions; same component used by Debts')
  stage='new-contact creation and duplicate prevention'
  const newName=result.run+'-new-contact'
  const third=await addThroughForm('they_owe_me',{id:'intent',name:newName,createName:newName},20)
  const contacts=(await api.get('/contacts')).data
  check(contacts.filter(item=>item.name===newName).length===1,'NEW_CONTACT_DUPLICATED')
  const before=result.requests.filter(item=>item.method==='POST'&&item.path==='/contacts').length
  await addThroughForm('i_owe_them',{id:'intent',name:' '+newName.toUpperCase()+' ',createName:' '+newName.toUpperCase()+' '},5)
  check(result.requests.filter(item=>item.method==='POST'&&item.path==='/contacts').length===before,'DUPLICATE_CONTACT_POSTED')
  check(third.contact_id===contacts.find(item=>item.name===newName).id,'CREATED_CONTACT_NOT_USED')
  pass('Explicit new-contact intent creates contact by name only; trimmed/case-insensitive recheck reuses existing contact')
  stage='cancel flow'
  const flow=await createDebtHarness(apiUrl)
  const mutations=result.requests.filter(item=>item.method!=='GET').length
  const options=flow.autocomplete().props.filterOptions(contacts,{inputValue:result.run+'-cancel'})
  flow.autocomplete().props.onChange(null,options.find(item=>item.createName))
  flow.cancel();flow.unmount()
  check(result.requests.filter(item=>item.method!=='GET').length===mutations,'CANCEL_WROTE_DATA')
  pass('Typed/explicit Create intent cancelled before Save makes no writes')
  stage='debt update/payment reversal'
  await api.patch(`/debts/${first.id}`,{amount:12})
  expected.get(first.id).amount=12
  await verifyTotals()
  for(const [debt,amounts]of[[first,[5,7,5]],[second,[5,5,5]]]){
    for(const amount of amounts){await api.post(`/debts/${debt.id}/payments`,{amount,note:result.run});expected.get(debt.id).paid+=amount;await verifyTotals()}
  }
  const state=await verifyTotals()
  check(finance.remaining({...first,amount:12},state.payments)===-5,'REVERSAL_MISMATCH')
  check(finance.remaining(second,state.payments)===-5,'INVERSE_REVERSAL_MISMATCH')
  check(finance.recentPayments(state.debts,state.payments,state.contacts).every((item,index,list)=>index===0||Date.parse(list[index-1].payment.paid_at)>=Date.parse(item.payment.paid_at)),'RECENT_ORDER_MISMATCH')
  pass('Debt update, partial/exact/overpayments and reversal in both directions; actual Dashboard totals/recent ordering')
  stage='profile'
  profileChanged=true
  await api.updateProfile(result.run)
  await api.updateProfile(originalName)
  check((await api.session()).data.user.name===originalName,'PROFILE_RESTORE_MISMATCH')
  profileChanged=false
  pass('QA profile name update and restore')
  stage='logout/relogin'
  await api.logout()
  unauthorized=false
  try{await api.session()}catch(error){unauthorized=error.response?.status===401}
  check(unauthorized,'LOGOUT_SESSION_NOT_CLEARED')
  await api.login(env.QA_EMAIL,env.QA_PASSWORD)
  check((await api.session()).data.user.id===ownerId,'RELOGIN_OWNER_MISMATCH')
  pass('Logout, 401 session and relogin to same QA account')
}catch(error){result.failures.push({stage,code:/^[A-Z_]+$/.test(error.message)?error.message:'CHECK_FAILED',status:error.response?.status});console.log(`FAIL: ${stage}; status=${error.response?.status??'none'}`)}
finally{
  if(api&&ownerId){
    if(profileChanged){try{await api.updateProfile(originalName);result.cleanup.push({name:'profile restore',passed:true})}catch{result.cleanup.push({name:'profile restore',passed:false})}}
    for(const kind of ['debts','contacts','folders'])for(const id of owned[kind]){
      try{await api.delete(`/${kind}/${id}`);check(!(await api.get(`/${kind}`)).data.some(item=>item.id===id),'DELETE_UNCONFIRMED');result.cleanup.push({kind,passed:true})}
      catch{result.cleanup.push({kind,id,passed:false})}
    }
    try{await api.logout();result.cleanup.push({name:'final logout',passed:true})}catch{result.cleanup.push({name:'final logout',passed:false})}
  }
  cookies.clear()
  if(server)await new Promise(resolve=>server.close(resolve))
  save()
  console.log(`Cleanup: ${result.cleanup.filter(item=>item.passed).length} passed; ${result.cleanup.filter(item=>!item.passed).length} unresolved.`)
  if(result.failures.length||result.cleanup.some(item=>!item.passed))process.exitCode=1
}
