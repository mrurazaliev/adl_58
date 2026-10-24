import worker from '../worker.mjs'

export default async function gateway(request, response) {
  try {
    const forwardedProtocol = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const protocol = process.env.VERCEL || forwardedProtocol === 'https' ? 'https' : 'http'
    const base = `${protocol}://${request.headers.host || 'localhost'}`
    const url = new URL(request.url || '/', base)
    const route = request.query?.path ?? url.searchParams.get('path')
    if (route != null) {
      const path = Array.isArray(route) ? route.join('/') : route
      if (!/^[a-zA-Z0-9/-]*$/.test(path)) {
        response.statusCode = 404
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ error: 'Route not found' }))
        return
      }
      url.pathname = `/api/${path}`
      url.searchParams.delete('path')
    }
    if (!url.pathname.startsWith('/api/')) url.pathname = '/api/'
    const headers = new Headers()
    for (const [key, value] of Object.entries(request.headers)) {
      if (value != null && !['host', 'content-length', 'connection'].includes(key)) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
    let body
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (request.body !== undefined) body = typeof request.body === 'string' || Buffer.isBuffer(request.body) ? request.body : JSON.stringify(request.body)
      else {
        const chunks = []
        let size = 0
        for await (const chunk of request) {
          size += Buffer.byteLength(chunk)
          if (size > 20000) {
            response.statusCode = 413
            response.setHeader('content-type', 'application/json')
            response.end(JSON.stringify({ error: 'Request too large' }))
            return
          }
          chunks.push(chunk)
        }
        body = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))
      }
    }
    const result = await worker.fetch(new Request(url, { method: request.method, headers, body }), {})
    response.statusCode = result.status
    result.headers.forEach((value, key) => { if (key !== 'set-cookie') response.setHeader(key, value) })
    const cookies = result.headers.getSetCookie()
    if (cookies.length) response.setHeader('set-cookie', cookies)
    response.end(result.status === 204 ? undefined : Buffer.from(await result.arrayBuffer()))
  } catch {
    response.statusCode = 503
    response.setHeader('content-type', 'application/json')
    response.setHeader('cache-control', 'no-store')
    response.end(JSON.stringify({ error: 'Service unavailable' }))
  }
}
