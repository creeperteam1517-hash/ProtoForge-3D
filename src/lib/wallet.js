/**
 * Server-backed token wallet (real money).
 *
 * The balance lives server-side (Netlify Functions + Blobs) keyed to an
 * anonymous account. The browser only stores a signed session token, which it
 * sends on every request; it cannot edit its own balance.
 *
 * Endpoints (see netlify/functions/* and the dev middleware in vite.config.js):
 *   POST /api/account          -> { token, balance }
 *   GET  /api/balance          -> { balance }
 *   POST /api/create-checkout  -> { url }   (redirect to Stripe)
 *   POST /api/confirm          -> { balance }
 *   POST /api/spend            -> { ok, balance }
 */

const TOKEN_KEY = 'forge_wallet_token_v1'

const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
const setStoredToken = (t) => {
  try {
    localStorage.setItem(TOKEN_KEY, t)
  } catch {
    /* storage unavailable */
  }
}
const clearStoredToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

const authHeaders = (token) => ({ 'x-wallet-token': token })

/** Create an account on the server (returns its token), caching it locally. */
async function createAccount() {
  const res = await fetch('/api/account', { method: 'POST' })
  if (!res.ok) throw new Error('Could not create wallet')
  const data = await res.json()
  setStoredToken(data.token)
  return data
}

/** Ensure we have a token, creating an account on first use. */
async function ensureToken() {
  return getStoredToken() || (await createAccount()).token
}

/** Current balance. Recreates the account if the stored token is rejected. */
export async function fetchBalance() {
  let token = await ensureToken()
  let res = await fetch('/api/balance', { headers: authHeaders(token) })
  if (res.status === 401) {
    // Token no longer valid (e.g. server secret rotated) — start fresh.
    clearStoredToken()
    token = (await createAccount()).token
    res = await fetch('/api/balance', { headers: authHeaders(token) })
  }
  if (!res.ok) throw new Error('Could not read balance')
  return (await res.json()).balance
}

/** Begin a Stripe Checkout for a pack id; redirects the browser to Stripe. */
export async function startCheckout(packId) {
  const token = await ensureToken()
  const res = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ packId, origin: window.location.origin }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Checkout is unavailable right now.')
  }
  window.location.href = data.url
}

/** After returning from Stripe, verify the session and credit tokens. */
export async function confirmCheckout(sessionId) {
  const token = await ensureToken()
  const res = await fetch('/api/confirm', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not confirm payment')
  return data.balance
}

/** Create an account with email + password (folds in the anonymous wallet). */
export async function signup(email, password) {
  const anon = await ensureToken()
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, anon }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Sign up failed.')
  setStoredToken(data.token)
  return data
}

/** Log in with email + password. */
export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Log in failed.')
  setStoredToken(data.token)
  return data
}

/** Who am I? -> { loggedIn, email, balance }. */
export async function fetchMe() {
  let token = await ensureToken()
  let res = await fetch('/api/me', { headers: authHeaders(token) })
  if (res.status === 401) {
    clearStoredToken()
    token = (await createAccount()).token
    res = await fetch('/api/me', { headers: authHeaders(token) })
  }
  if (!res.ok) throw new Error('Could not load account')
  return res.json()
}

/** Log out: drop the session and start a fresh anonymous account. */
export async function logout() {
  clearStoredToken()
  await createAccount()
}

/** Spend the cost of one print, server-side. Returns { ok, balance }. */
export async function spendPrint() {
  const token = await ensureToken()
  const res = await fetch('/api/spend', {
    method: 'POST',
    headers: authHeaders(token),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data.ok === true, balance: data.balance ?? 0 }
}
