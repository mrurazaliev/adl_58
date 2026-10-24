const BACKEND = 'https://debt-back-cvif.onrender.com';
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const readJson = response => response.status === 204 ? Promise.resolve(null) : response.json().catch(() => ({error:'Invalid server response'}));
const cookies = request => Object.fromEntries((request.headers.get('cookie') || '').split(';').map(p=>p.trim().split(/=(.*)/s)).filter(p=>p[0]));
function setTokens(response, data, secure) {
  for (const [key, age] of [['accessToken', 900], ['refreshToken', 2592000]]) {
    response.headers.append('Set-Cookie', `adl_${key}=${encodeURIComponent(data[key] || '')}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${data[key] ? age : 0}${secure ? '; Secure' : ''}`);
  }
  return response;
}
async function upstream(path, method='GET', body, token) {
  const headers = {'accept':'application/json'};
  if(body)headers['content-type']='application/json';
  if(token)headers.authorization=`Bearer ${token}`;
  return fetch(BACKEND+path,{method,headers,body,signal:AbortSignal.timeout(28000),redirect:'error'});
}
async function api(request) {
  const url=new URL(request.url), path=url.pathname, secure=url.protocol==='https:';
  if(!['GET','POST','PATCH','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method!=='GET') {
    if(request.headers.get('origin') && request.headers.get('origin')!==url.origin)return json({error:'Origin not allowed'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON body required'},415);
    const size=Number(request.headers.get('content-length')||0);if(size>20000)return json({error:'Request too large'},413);
  }
  if(path==='/api/health') {const r=await upstream('/health');return json(await readJson(r),r.status);}
  const allowed=/^\/api\/(auth\/(login|register|logout|session)|users\/me|dashboard\/summary|folders(?:\/[a-f0-9-]+)?|contacts(?:\/[a-f0-9-]+)?|debts(?:\/[a-f0-9-]+(?:\/payments)?)?)$/;
  if(!allowed.test(path))return json({error:'Route not found'},404);
  const c=cookies(request);let access=decodeURIComponent(c.adl_accessToken||''), refresh=decodeURIComponent(c.adl_refreshToken||'');
  let rotated;
  const body=request.method==='GET'?undefined:await request.text();
  if(body && body.length>20000)return json({error:'Request too large'},413);
  if(['/api/auth/login','/api/auth/register'].includes(path)) {
    const r=await upstream(path,request.method,body);const data=await readJson(r);
    if(!r.ok)return json(data,r.status);
    return setTokens(json({user:data.user},r.status),data,secure);
  }
  if(path==='/api/auth/logout') {
    if(refresh) {try{await upstream(path,'POST',JSON.stringify({refreshToken:refresh}));}catch{}}
    return setTokens(json({message:'Logged out'}),{},secure);
  }
  const actualPath=path==='/api/auth/session'?'/api/users/me':path+url.search;
  let r=await upstream(actualPath,request.method,body,access);
  if(r.status===401 && refresh) {
    const rr=await upstream('/api/auth/refresh','POST',JSON.stringify({refreshToken:refresh}));
    if(rr.ok) {rotated=await readJson(rr);r=await upstream(actualPath,request.method,body,rotated.accessToken);}
  }
  const data=await readJson(r);
  let response=r.status===204?new Response(null,{status:204,headers:{'cache-control':'no-store'}}):json(path==='/api/auth/session'&&r.ok?{user:data}:data,r.status);
  if(rotated)response=setTokens(response,rotated,secure);
  if(r.status===401)response=setTokens(response,{},secure);
  return response;
}
export default {async fetch(request,env) {
  let response;
  try {
    if(new URL(request.url).pathname.startsWith('/api/'))response=await api(request);
    else {
      response=await env.ASSETS.fetch(request);
      if(response.status===404 && !new URL(request.url).pathname.split('/').pop().includes('.'))response=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url),request));
    }
  } catch {response=json({error:'The server is unavailable. Please try again in a moment.'},503);}
  response=new Response(response.body,response);
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options','SAMEORIGIN');
  response.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'");
  return response;
}};
