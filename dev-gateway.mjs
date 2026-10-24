const BACKEND = 'https://debt-back-cvif.onrender.com'

const readBody = request => new Promise((resolve, reject) => {
  let body = ''
  request.on('data', chunk => {
    body += chunk
    if (body.length > 20000) reject(new Error('Request too large'))
  })
  request.on('end', () => resolve(body))
  request.on('error', reject)
})

const parseCookies = value => Object.fromEntries(
  String(value || '')
    .split(';')
    .map(part => part.trim().split(/=(.*)/s))
    .filter(part => part[0])
)

const sendJson = (response, status, data, cookies = []) => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  if (cookies.length) response.setHeader('set-cookie', cookies)
  response.end(JSON.stringify(data))
}

const tokenCookies = data => [
  `adl_accessToken=${encodeURIComponent(data.accessToken || '')}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${data.accessToken ? 900 : 0}`,
  `adl_refreshToken=${encodeURIComponent(data.refreshToken || '')}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${data.refreshToken ? 2592000 : 0}`
]

const upstream = async (path, method = 'GET', body, token) => {
  const headers = { accept: 'application/json' }
  if (body) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  return fetch(BACKEND + path, {
    method,
    headers,
    body: body || undefined,
    signal: AbortSignal.timeout(28000),
    redirect: 'error'
  })
}

const readJson = async response => response.status === 204 ? null : response.json().catch(() => ({ error: 'Invalid server response' }))

const handleApi = async (request, response) => {
  const host = request.headers.host || 'localhost:5173'
  const url = new URL(request.originalUrl || request.url || '/', `http://${host}`)
  const path = url.pathname
  const method = request.method || 'GET'

  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  if (path === '/api/health') {
    const result = await upstream('/health')
    sendJson(response, result.status, await readJson(result))
    return
  }

  const allowed = /^\/api\/(auth\/(login|register|logout|session)|users\/me|dashboard\/summary|folders(?:\/[a-f0-9-]+)?|contacts(?:\/[a-f0-9-]+)?|debts(?:\/[a-f0-9-]+(?:\/payments)?)?)$/
  if (!allowed.test(path)) {
    sendJson(response, 404, { error: 'Route not found' })
    return
  }

  let body
  if (method !== 'GET') {
    if (request.headers.origin && request.headers.origin !== url.origin) {
      sendJson(response, 403, { error: 'Origin not allowed' })
      return
    }
    if (!String(request.headers['content-type'] || '').startsWith('application/json')) {
      sendJson(response, 415, { error: 'JSON body required' })
      return
    }
    body = await readBody(request)
  }

  const cookies = parseCookies(request.headers.cookie)
  let access = decodeURIComponent(cookies.adl_accessToken || '')
  const refresh = decodeURIComponent(cookies.adl_refreshToken || '')

  if (path === '/api/auth/login' || path === '/api/auth/register') {
    const result = await upstream(path, method, body)
    const data = await readJson(result)
    if (!result.ok) {
      sendJson(response, result.status, data)
      return
    }
    sendJson(response, result.status, { user: data.user }, tokenCookies(data))
    return
  }

  if (path === '/api/auth/logout') {
    if (refresh) {
      try {
        await upstream(path, 'POST', JSON.stringify({ refreshToken: refresh }))
      } catch {}
    }
    sendJson(response, 200, { message: 'Logged out' }, tokenCookies({}))
    return
  }

  const actualPath = path === '/api/auth/session' ? '/api/users/me' : path + url.search
  let result = await upstream(actualPath, method, body, access)
  let rotated

  if (result.status === 401 && refresh) {
    const refreshResult = await upstream('/api/auth/refresh', 'POST', JSON.stringify({ refreshToken: refresh }))
    if (refreshResult.ok) {
      rotated = await readJson(refreshResult)
      access = rotated.accessToken
      result = await upstream(actualPath, method, body, access)
    }
  }

  const data = await readJson(result)
  const output = path === '/api/auth/session' && result.ok ? { user: data } : data
  const nextCookies = rotated ? tokenCookies(rotated) : result.status === 401 ? tokenCookies({}) : []

  if (result.status === 204) {
    response.statusCode = 204
    response.setHeader('cache-control', 'no-store')
    if (nextCookies.length) response.setHeader('set-cookie', nextCookies)
    response.end()
    return
  }

  sendJson(response, result.status, output, nextCookies)
}

export const devGateway = () => ({
  name: 'adl58-dev-gateway',
  configureServer(server) {
    server.middlewares.use('/api', async (request, response) => {
      try {
        await handleApi(request, response)
      } catch {
        sendJson(response, 503, { error: 'The server is unavailable. Please try again in a moment.' })
      }
    })
  }
})
