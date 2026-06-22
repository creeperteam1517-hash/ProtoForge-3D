/**
 * Production GLB download proxy.
 *
 * Generated model files live on a dynamic CDN host that does NOT send CORS
 * headers, so the browser can't fetch them directly. This downloads the file
 * server-side and streams it back. Usage: /api/proxy?target=<encoded url>
 *
 * Mirrors the dev-only Vite middleware in vite.config.js (downloadProxy()),
 * including the browser-like User-Agent and retry on transient gateway errors.
 *
 * NOTE: Netlify synchronous functions cap responses at ~6 MB. Very large GLBs
 * could exceed that; if that happens, a streaming/background function would be
 * needed instead.
 */
const TRANSIENT = new Set([502, 503, 504])
const MAX_ATTEMPTS = 4
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const handler = async (event) => {
  const target = event.queryStringParameters?.target
  if (!target) {
    return { statusCode: 400, body: 'Missing target' }
  }

  let lastInfo = ''
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI3DForge/1.0)' },
      })
      if (!upstream.ok) {
        lastInfo = `upstream ${upstream.status}`
        if (TRANSIENT.has(upstream.status) && attempt < MAX_ATTEMPTS) {
          await sleep(500 * attempt)
          continue
        }
        return { statusCode: upstream.status, body: `Upstream ${upstream.status}` }
      }
      const buf = Buffer.from(await upstream.arrayBuffer())
      return {
        statusCode: 200,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
        },
        body: buf.toString('base64'),
        isBase64Encoded: true,
      }
    } catch (err) {
      lastInfo = err.message
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * attempt)
        continue
      }
    }
  }

  return { statusCode: 502, body: `Proxy error: ${lastInfo}` }
}
