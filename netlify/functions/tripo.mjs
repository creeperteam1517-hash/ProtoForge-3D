/**
 * Production proxy for Tripo3D (https://api.tripo3d.ai).
 *
 * The browser calls /api/tripo/* (no credentials). This function forwards the
 * request to Tripo and injects the secret API key from the TRIPO_API_KEY
 * environment variable, so the key never ships to the client.
 *
 * Mirrors the dev-only Vite proxy in vite.config.js (apiProxy()).
 * Route is wired in netlify.toml: /api/tripo/* -> /.netlify/functions/tripo/:splat
 */
const UPSTREAM = 'https://api.tripo3d.ai'

export const handler = async (event) => {
  const key = process.env.TRIPO_API_KEY
  if (!key) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'AI is not configured (missing TRIPO_API_KEY).' }),
    }
  }

  // Strip the function/redirect prefix to recover the upstream path, e.g.
  // /.netlify/functions/tripo/v2/openapi/task -> /v2/openapi/task
  const subPath = event.path.replace(/^.*\/(?:functions\/tripo|api\/tripo)/, '') || '/'
  const url = `${UPSTREAM}${subPath}${event.rawQuery ? `?${event.rawQuery}` : ''}`

  const method = event.httpMethod || 'GET'
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64')
        : event.body

  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body,
    })
    const buf = Buffer.from(await upstream.arrayBuffer())
    return {
      statusCode: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
