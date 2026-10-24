import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const source = path => ts.transpileModule(fs.readFileSync(`src/${path}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const resolvePackages = code => code.replace(/(['"])(react(?:\/jsx-runtime)?|react-router-dom|react-i18next|i18next|@mui\/[^'"]+)\1/g, (_, quote, name) => JSON.stringify(import.meta.resolve(name)))
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
const translationsUrl = url(source('translations.ts'))
const i18nUrl = url(resolvePackages(source('i18n.ts')).replace("'./translations'", JSON.stringify(translationsUrl)))
const { default: i18n } = await import(i18nUrl)
const themeUrl = url(source('theme.ts'))
const appearanceUrl = url(resolvePackages(source('components/AppearanceControls.tsx')).replace("'../theme'", JSON.stringify(themeUrl)))
const homeUrl = url(resolvePackages(source('pages/Home.tsx')).replace("'../components/AppearanceControls'", JSON.stringify(appearanceUrl)))
const { default: Home } = await import(homeUrl)
const sessionUrl = url(resolvePackages(source('components/SessionLoading.tsx')))
const { default: SessionLoading } = await import(sessionUrl)
const skeletonUrl = url(resolvePackages(source('components/ContentSkeleton.tsx')))
const { default: ContentSkeleton } = await import(skeletonUrl)

for (const language of ['ru', 'tg', 'en']) {
  await i18n.changeLanguage(language)
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Home)))
  assert.equal((html.match(/class="landing-feature"/g) || []).length, 6)
  assert.equal((html.match(/<li>/g) || []).length, 4)
  assert.ok(html.includes('<header') && html.includes('<footer'))
  assert.ok(html.includes('href="/login"') && html.includes('href="/register"'))
  assert.equal((html.match(/<button\b/g) || []).length, 1)
  assert.equal(/demo|DEMO/.test(html), false)
  assert.ok(html.includes(i18n.t('Как начать работу')))
  const loading = renderToStaticMarkup(React.createElement(SessionLoading))
  assert.ok(loading.includes('MuiCircularProgress-root') && loading.includes('aria-busy="true"'))
  assert.ok(loading.includes(i18n.t('Проверка сессии…')))
  const summary = renderToStaticMarkup(React.createElement(ContentSkeleton, { variant: 'summary' }))
  assert.equal((summary.match(/class="summary-card"/g) || []).length, 3)
  assert.ok(summary.includes('MuiSkeleton-root') && summary.includes(i18n.t('Загрузка данных…')))
  const dashboard = renderToStaticMarkup(React.createElement(ContentSkeleton, { variant: 'dashboard' }))
  assert.ok(dashboard.includes('chart-panel') && dashboard.includes('recent-panel'))
}

const hooks = url('export const lazy = () => function WorkspaceLayout() {}; export const useState = initial => { const h=globalThis.authHarness,index=h.index++; if (!(index in h.state)) h.state[index]=initial; return [h.state[index],value=>{h.state[index]=value}]; }; export const useEffect = fn => { const h=globalThis.authHarness; if(h.initial) h.effects.push(fn); };')
const jsx = url('export const jsx = (type,props)=>({type,props}); export const jsxs=jsx;')
const router = url('export const useLocation=()=>({pathname:globalThis.authHarness.path});export const useNavigate=()=>globalThis.authHarness.navigate;export function Outlet(){};')
const language = url('export const useTranslation=()=>({t:key=>key});')
const api = url('export default {session:signal=>{globalThis.authHarness.signal=signal;return globalThis.authHarness.pending}};export const getErrorMessage=()=>"API failure";')
const loadingStub = url('export default function SessionLoading(){}')
const appCode = source('App.tsx').replace('"react/jsx-runtime"',JSON.stringify(jsx)).replace("'react'",JSON.stringify(hooks)).replace("'react-router-dom'",JSON.stringify(router)).replace("'react-i18next'",JSON.stringify(language)).replace("'./api'",JSON.stringify(api)).replace("'./components/SessionLoading'",JSON.stringify(loadingStub))
const {default:App}=await import(url(appCode))
const testRoute = async (path, outcome) => {
  let resolve,reject
  const pending=new Promise((yes,no)=>{resolve=yes;reject=no})
  const h={path,index:0,state:[],effects:[],initial:true,pending,navigations:[]}
  h.navigate=(path,options)=>h.navigations.push({path,options})
  globalThis.authHarness=h
  const render=()=>{h.index=0;return App()}
  assert.equal(render().type.name,'SessionLoading')
  h.initial=false
  const cleanups=h.effects.map(effect=>effect())
  assert.equal(render().type.name,'SessionLoading')
  if(outcome==='authenticated')resolve({data:{user:{id:'test',name:'Test'}}})
  else reject({response:{status:outcome}})
  await new Promise(resolve=>setImmediate(resolve))
  const tree=render()
  if(outcome===401){assert.equal(h.navigations.length,0);assert.equal(tree.type.name,'Outlet')}
  else if(outcome==='authenticated'){assert.equal(h.navigations[0].path,'/dashboard');assert.equal(h.navigations[0].options.replace,true)}
  else {assert.equal(tree.props.role,'alert');assert.equal(h.navigations.length,0);assert.notEqual(tree.type.name,'SessionLoading')}
  cleanups.forEach(cleanup=>cleanup?.())
  assert.equal(h.signal.aborted,true)
}
for (const path of ['/', '/', '/login', '/register']) await testRoute(path,401)
await testRoute('/','authenticated')
await testRoute('/login','authenticated')
await testRoute('/',503)
const css=fs.readFileSync('src/index.css','utf8')
assert.ok(css.includes('.session-loading {') && css.includes('background: var(--page)'))
assert.ok(css.includes('@media (max-width: 900px)') && css.includes('.landing-feature-grid, .landing-step-grid, .landing-info-grid { grid-template-columns: 1fr; }'))
assert.ok(css.includes('.public-controls .text-link { display: inline-flex; }'))
for(const [page,variant]of[['Contacts','table'],['Folders','folders'],['Debts','table'],['Dashboard','dashboard']]){
 const code=fs.readFileSync(`src/pages/${page}.tsx`,'utf8')
 assert.ok(code.includes(`loading && !error && <ContentSkeleton variant="${variant}"`))
 assert.ok(code.includes('aria-busy={loading && !error}'))
}
console.log('PASS: logged-out root/refresh/login/register do not redirect; authenticated public entry routes to Dashboard; pending/slow session uses spinner, 503 resolves to error; RU/TJ/EN landing structure and CTAs, one theme toggle, skeleton dimensions/labels, theme-token loading and responsive rules. SSR/controlled tests; browser visuals remain unverified.')
