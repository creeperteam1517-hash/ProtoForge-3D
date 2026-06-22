import dns from 'node:dns'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Prefer IPv4 when resolving upstream hosts. On some networks the TLS handshake
// to Tripo's AWS CloudFront CDN over IPv6 gets reset, which surfaced as GLB
// downloads failing with "fetch failed" (HTTP 502 from /api/proxy). Forcing
// IPv4-first resolution avoids the broken IPv6 path.
dns.setDefaultResultOrder('ipv4first')

// Vite's built-in server.proxy doesn't honor the setting above and stalls on a
// dual-stack network when reaching Tripo's AWS-fronted API (which froze AI
// generation at 0%). The apiProxy() plugin below forwards those calls with
// fetch() instead, which does honor ipv4first.

// Dev-only middleware that downloads a remote file server-side and streams it
// back to the browser. Used to fetch generated model files (GLB) from dynamic
// CDN hosts that don't send CORS headers. Usage: /api/proxy?target=<encoded url>
function downloadProxy() {
  return {
    name: 'download-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const target = new URL(req.url, 'http://localhost').searchParams.get('target')
        if (!target) {
          res.statusCode = 400
          return res.end('Missing target')
        }

        // CDN hosts (Tripo's model store sits behind a gateway) intermittently
        // return 502/503/504, and the default Node fetch User-Agent is sometimes
        // rejected. Send a browser-like UA and retry transient gateway errors.
        const TRANSIENT = new Set([502, 503, 504])
        const MAX_ATTEMPTS = 4
        let lastInfo = ''

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            const upstream = await fetch(target, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI3DForge/1.0)' },
            })
            if (!upstream.ok) {
              lastInfo = `upstream ${upstream.status}`
              if (TRANSIENT.has(upstream.status) && attempt < MAX_ATTEMPTS) {
                console.warn(`[proxy] ${lastInfo}, retry ${attempt}/${MAX_ATTEMPTS - 1}: ${target}`)
                await new Promise((r) => setTimeout(r, 500 * attempt))
                continue
              }
              console.error(`[proxy] giving up (${lastInfo}): ${target}`)
              res.statusCode = upstream.status
              return res.end(`Upstream ${upstream.status}`)
            }
            res.statusCode = 200
            res.setHeader(
              'Content-Type',
              upstream.headers.get('content-type') || 'application/octet-stream'
            )
            const buf = Buffer.from(await upstream.arrayBuffer())
            return res.end(buf)
          } catch (err) {
            lastInfo = err.message
            if (attempt < MAX_ATTEMPTS) {
              console.warn(`[proxy] fetch threw, retry ${attempt}/${MAX_ATTEMPTS - 1}: ${err.message}`)
              await new Promise((r) => setTimeout(r, 500 * attempt))
              continue
            }
          }
        }

        console.error(`[proxy] failed after ${MAX_ATTEMPTS} attempts (${lastInfo}): ${target}`)
        res.statusCode = 502
        res.end(`Proxy error: ${lastInfo}`)
      })
    },
  }
}

// Dev-only middleware that runs the token-wallet backend (the SAME handlers as
// netlify/functions/*) so /api/account, /api/balance, /api/create-checkout,
// /api/confirm and /api/spend work under `npm run dev`. In production these are
// served by the Netlify functions.
function tokenApi() {
  const send = (res, status, body) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
  const readBody = async (req) => {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const raw = Buffer.concat(chunks).toString('utf8')
    try {
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }
  return {
    name: 'token-api',
    configureServer(server) {
      const route = (path, fn) =>
        server.middlewares.use(path, async (req, res) => {
          try {
            const h = await import('./server/handlers.js')
            const u = new URL(req.url, 'http://localhost')
            const query = Object.fromEntries(u.searchParams)
            const body = req.method === 'POST' ? await readBody(req) : {}
            const baseUrl = `http://${req.headers.host || '127.0.0.1:5173'}`
            const out = await fn(h, { headers: req.headers, body, query, baseUrl })
            if (out.redirect) {
              res.statusCode = out.status || 302
              res.setHeader('Location', out.redirect)
              return res.end()
            }
            send(res, out.status, out.json)
          } catch (err) {
            console.error(`[token-api] ${path}:`, err)
            send(res, 500, { error: err.message })
          }
        })
      route('/api/account', (h) => h.handleAccount())
      route('/api/balance', (h, c) => h.handleBalance(c.headers))
      route('/api/create-checkout', (h, c) => h.handleCreateCheckout(c.headers, c.body))
      route('/api/confirm', (h, c) => h.handleConfirm(c.headers, c.body))
      route('/api/spend', (h, c) => h.handleSpend(c.headers))
      route('/api/me', (h, c) => h.handleMe(c.headers))
      route('/api/auth/signup', (h, c) => h.handleSignup(c.headers, c.body))
      route('/api/auth/login', (h, c) => h.handleLogin(c.headers, c.body))
    },
  }
}

// Forwards /api/tripo and /api/meshy to the upstream APIs over IPv4. We do this
// ourselves instead of Vite's server.proxy because that proxy ignores the IPv4
// agent and stalls on dual-stack networks (hangs AI generation at 0%).
function apiProxy() {
  // Each target carries the host plus the env var holding its secret API key.
  // The key is injected here (server-side) so it never ships to the browser,
  // matching the production Netlify functions (netlify/functions/tripo.mjs).
  const targets = {
    '/api/tripo': { host: 'api.tripo3d.ai', keyVar: 'TRIPO_API_KEY' },
    '/api/meshy': { host: 'api.meshy.ai', keyVar: 'MESHY_API_KEY' },
  }
  return {
    name: 'api-proxy',
    configureServer(server) {
      for (const [prefix, { host, keyVar }] of Object.entries(targets)) {
        server.middlewares.use(prefix, async (req, res) => {
          try {
            const chunks = []
            for await (const c of req) chunks.push(c)
            const body = chunks.length ? Buffer.concat(chunks) : undefined

            // Forward the relevant headers; let fetch set host/encoding/length.
            const headers = { ...req.headers }
            for (const k of ['host', 'connection', 'accept-encoding', 'content-length']) {
              delete headers[k]
            }
            // Inject the secret key from .env (don't trust any client header).
            const key = process.env[keyVar]
            if (key) headers.authorization = `Bearer ${key}`

            // req.url has the mount prefix already stripped by Connect.
            const upstream = await fetch(`https://${host}${req.url}`, {
              method: req.method,
              headers,
              body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
            })

            res.statusCode = upstream.status
            upstream.headers.forEach((v, k) => {
              if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) {
                res.setHeader(k, v)
              }
            })
            res.end(Buffer.from(await upstream.arrayBuffer()))
          } catch (err) {
            console.error(`[api-proxy] ${prefix}:`, err.message)
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      }
    },
  }
}

// Config is a function so we can loadEnv() and mount the token API in dev.
export default defineConfig(({ mode }) => {
  // Load .env so the dev token backend can read the secrets (Vite only exposes
  // VITE_-prefixed vars to the client; the server middleware needs these too).
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['STRIPE_SECRET_KEY', 'TOKEN_SECRET', 'TRIPO_API_KEY', 'MESHY_API_KEY']) {
    process.env[k] = process.env[k] || env[k] || ''
  }

  return {
  plugins: [react(), downloadProxy(), tokenApi(), apiProxy()],
  server: {
    port: 5173,
    // Listen on all interfaces so localhost / 127.0.0.1 / LAN IP all resolve
    // (the IPv4-first setting otherwise binds only to 127.0.0.1, which can make
    // a browser hitting localhost over IPv6 fail with "site can't be reached").
    host: true,
    // Note: /api/tripo and /api/meshy are forwarded by the apiProxy() plugin
    // above (IPv4-forced); model GLB downloads go through downloadProxy().
  },
  }
})
