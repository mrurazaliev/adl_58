import assert from 'node:assert/strict'
import fs from 'node:fs'
import worker from './worker.mjs'

const paths = ['/', '/login', '/register', '/dashboard', '/debts', '/archive', '/contacts', '/folders', '/users', '/forgot-password', '/unknown-route', '/reports']
const index = fs.readFileSync('dist/index.html', 'utf8')
const hits = []
const assets = { ASSETS: { fetch: async request => {
  const path = new URL(request.url).pathname
  hits.push(path)
  return path === '/index.html' ? new Response(index, { headers: { 'content-type': 'text/html' } }) : new Response('Not found', { status: 404 })
} } }
for (const path of paths) {
  for (let refresh = 0; refresh < 2; refresh++) {
    const response = await worker.fetch(new Request(`https://qa.invalid${path}`), assets)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), index)
    assert.ok(response.headers.get('content-security-policy').includes("connect-src 'self'"))
  }
}
const missingAsset = await worker.fetch(new Request('https://qa.invalid/assets/missing.js'), assets)
assert.equal(missingAsset.status, 404)
const apiMissing = await worker.fetch(new Request('https://qa.invalid/api/unknown'), assets)
assert.equal(apiMissing.status, 404)
assert.ok(hits.includes('/index.html'))
const main = fs.readFileSync('src/main.tsx', 'utf8')
for (const path of paths.slice(1, 10)) assert.ok(main.includes(`path: '${path.slice(1)}'`))
assert.ok(main.includes("path: '*'"))
assert.ok(main.includes('errorElement:'))
assert.ok(main.includes('Suspense fallback='))
assert.equal(/reports/i.test(main + fs.readFileSync('src/components/WorkspaceLayout.tsx', 'utf8')), false)
for (const page of ['Contacts', 'Folders', 'Debts', 'Dashboard']) {
  const code = fs.readFileSync(`src/pages/${page}.tsx`, 'utf8')
  assert.ok(code.includes('return () => requestController.current?.abort()'))
  assert.ok(code.includes('if (signal.aborted) return'))
  assert.ok(code.includes('if (!signal.aborted) setLoading(false)'))
}
const scripts = fs.readdirSync('dist/assets').filter(name => name.endsWith('.js'))
assert.ok(scripts.filter(name => /^(Home|Login|Register|Dashboard|Debts|Archive|Contacts|Folders|Users)-/.test(name)).length === 9)
const largest = Math.max(...scripts.map(name => fs.statSync(`dist/assets/${name}`).size))
assert.ok(largest < 500000)
if (process.argv[2]) {
  for (const path of paths) {
    for (let refresh = 0; refresh < 2; refresh++) {
      const response = await fetch(new URL(path, process.argv[2]))
      assert.equal(response.status, 200)
      assert.equal(await response.text(), index)
    }
  }
  for (const asset of index.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
    assert.equal((await fetch(new URL(asset[1], process.argv[2]))).status, 200)
  }
  console.log('PASS: production-preview HTTP direct navigation/repeat-refresh shell responses for all routes, unknown route and removed Reports; referenced JS/CSS assets available.')
}
console.log(`PASS: worker SPA fallback, asset/API 404s, same-origin CSP, route configuration/fallback/error boundary, load cleanup guards, lazy route chunks and largest JS chunk ${largest} bytes. Browser execution/visuals not tested.`)
