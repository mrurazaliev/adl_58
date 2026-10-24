import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import gateway from './api/gateway.js'

const originalFetch=globalThis.fetch
const originalVercel=process.env.VERCEL
process.env.VERCEL='1'
const upstreamCalls=[]
globalThis.fetch=async (address,options)=>{
  if(!String(address).startsWith('https://debt-back-cvif.onrender.com'))return originalFetch(address,options)
  const path=new URL(address).pathname
  upstreamCalls.push({path,method:options.method,authorized:options.headers.authorization==='Bearer test-access'})
  if(path==='/health')return Response.json({status:'ok'})
  if(path==='/api/auth/login')return Response.json({user:{id:'qa',name:'Test',email:'test@example.invalid'},accessToken:'test-access',refreshToken:'test-refresh'})
  if(path==='/api/auth/refresh')return Response.json({accessToken:'test-access',refreshToken:'test-refresh'})
  if(!options.headers.authorization||options.headers.authorization==='Bearer expired')return Response.json({error:'Unauthorized'},{status:401})
  if(options.method==='DELETE')return new Response(null,{status:204})
  return Response.json(path==='/api/users/me'?{id:'qa',name:'Test',email:'test@example.invalid'}:[])
}
const server=http.createServer(gateway)
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const host=`127.0.0.1:${server.address().port}`
try{
  for(const [path,status]of[['health',200],['auth/session',401],['contacts',401],['folders',401],['debts',401],['unsupported',404]]){
    const response=await originalFetch(`http://${host}/api/gateway?path=${path}`)
    assert.equal(response.status,status)
    assert.ok(response.headers.get('content-type').includes('application/json'))
  }
  const login=await originalFetch(`http://${host}/api/gateway?path=auth/login`,{method:'POST',headers:{origin:`https://${host}`,'content-type':'application/json'},body:JSON.stringify({email:'test@example.invalid',password:'mock-password'})})
  assert.equal(login.status,200)
  assert.equal(login.headers.getSetCookie().length,2)
  assert.ok(login.headers.getSetCookie().every(cookie=>cookie.includes('HttpOnly')&&cookie.includes('Secure')))
  assert.equal('accessToken'in await login.json(),false)
  const session=await originalFetch(`http://${host}/api/gateway?path=auth/session`,{headers:{cookie:'adl_accessToken=expired; adl_refreshToken=test-refresh'}})
  assert.equal(session.status,200)
  assert.ok(upstreamCalls.some(call=>call.path==='/api/auth/refresh'))
  const deletion=await originalFetch(`http://${host}/api/gateway?path=contacts/abc`,{method:'DELETE',headers:{origin:`https://${host}`,'content-type':'application/json',cookie:'adl_accessToken=test-access'},body:'{}'})
  assert.equal(deletion.status,204)
  assert.equal(await deletion.text(),'')
  const forbidden=await originalFetch(`http://${host}/api/gateway?path=auth/login`,{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'})
  assert.equal(forbidden.status,403)
  const config=JSON.parse(fs.readFileSync('vercel.json','utf8'))
  assert.equal(config.rewrites[0].source,'/api/:path*')
  assert.ok(config.rewrites[1].source.includes('(?!api'))
  console.log('PASS: Vercel adapter JSON API routing/404/401, same-origin checks, HttpOnly/Secure cookies, server refresh, no frontend tokens and empty DELETE 204. Mocked upstream only; Vercel deployment itself not exercised.')
}finally{
  await new Promise(resolve=>server.close(resolve))
  globalThis.fetch=originalFetch
  if(originalVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=originalVercel
}
