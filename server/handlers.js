/**
 * Framework-agnostic request handlers. Each takes already-parsed inputs
 * (lowercased headers, parsed JSON body) and returns { status, json }.
 *
 * The same handlers run under Netlify Functions (production) and the Vite dev
 * middleware (local dev) — see netlify/functions/* and vite.config.js.
 */
import { sign, verify, newId } from './accounts.js'
import {
  ensureAccount,
  getBalance,
  getAccount,
  credit,
  spend,
  setCredentials,
  mergeWallet,
} from './tokens.js'
import { createCheckout, retrieveSession, stripeConfigured } from './stripe.js'
import {
  normalizeEmail,
  validEmail,
  emailToId,
  hashPassword,
  verifyPassword,
} from './auth.js'
import { TOKENS_PER_PRINT, getPack } from './economy.js'

const tokenFrom = (headers = {}) =>
  headers['x-wallet-token'] ||
  (headers['authorization'] || '').replace(/^Bearer\s+/i, '') ||
  ''

/** POST /api/account — mint a fresh anonymous account (with starter grant). */
export async function handleAccount() {
  const id = newId()
  await ensureAccount(id)
  return { status: 200, json: { token: sign(id), balance: await getBalance(id) } }
}

/** GET /api/balance */
export async function handleBalance(headers) {
  const id = verify(tokenFrom(headers))
  if (!id) return { status: 401, json: { error: 'invalid token' } }
  return { status: 200, json: { balance: await getBalance(id) } }
}

/** POST /api/create-checkout { packId, origin } -> { url } */
export async function handleCreateCheckout(headers, body) {
  if (!stripeConfigured())
    return { status: 503, json: { error: 'Payments are not configured yet.' } }
  const id = verify(tokenFrom(headers))
  if (!id) return { status: 401, json: { error: 'invalid token' } }
  const pack = getPack(body?.packId)
  if (!pack) return { status: 400, json: { error: 'unknown pack' } }
  const origin = body?.origin || ''
  const url = await createCheckout({ pack, accountId: id, origin })
  return { status: 200, json: { url } }
}

/** POST /api/confirm { sessionId } — verify payment with Stripe, credit tokens. */
export async function handleConfirm(headers, body) {
  if (!stripeConfigured())
    return { status: 503, json: { error: 'Payments are not configured yet.' } }
  const id = verify(tokenFrom(headers))
  if (!id) return { status: 401, json: { error: 'invalid token' } }
  const sessionId = body?.sessionId
  if (!sessionId) return { status: 400, json: { error: 'missing sessionId' } }

  const session = await retrieveSession(sessionId)
  if (!session || session.metadata?.accountId !== id)
    return { status: 400, json: { error: 'session does not belong to this account' } }
  if (session.payment_status !== 'paid')
    return { status: 402, json: { error: 'payment not completed', balance: await getBalance(id) } }

  const tokens = Number(session.metadata?.tokens || 0)
  const balance = await credit(id, tokens, session.id) // idempotent on session.id
  return { status: 200, json: { balance, credited: tokens } }
}

/** POST /api/spend — deduct the cost of one print, server-side. */
export async function handleSpend(headers) {
  const id = verify(tokenFrom(headers))
  if (!id) return { status: 401, json: { error: 'invalid token' } }
  const r = await spend(id, TOKENS_PER_PRINT)
  if (!r.ok)
    return { status: 402, json: { ok: false, error: 'insufficient tokens', balance: r.balance } }
  return { status: 200, json: { ok: true, balance: r.balance } }
}

// ---- Auth (email + password) ----

// A logged-in account id is namespaced "e_<hash>"; anonymous ids are not.
const isLoggedIn = (id) => typeof id === 'string' && id.startsWith('e_')

/** GET /api/me — who am I + current balance. */
export async function handleMe(headers) {
  const id = verify(tokenFrom(headers))
  if (!id) return { status: 401, json: { error: 'invalid token' } }
  const acc = await getAccount(id)
  return {
    status: 200,
    json: {
      loggedIn: isLoggedIn(id),
      email: acc?.email || null,
      balance: acc?.balance ?? 0,
    },
  }
}

/** POST /api/auth/signup { email, password, anon } -> { token, email, balance } */
export async function handleSignup(headers, body) {
  const email = normalizeEmail(body?.email)
  const password = body?.password || ''
  if (!validEmail(email))
    return { status: 400, json: { error: 'Please enter a valid email address.' } }
  if (password.length < 6)
    return { status: 400, json: { error: 'Password must be at least 6 characters.' } }

  const id = emailToId(email)
  const existing = await getAccount(id)
  if (existing && existing.pwHash)
    return { status: 409, json: { error: 'An account with that email already exists. Log in instead.' } }

  await ensureAccount(id)
  const { salt, hash } = hashPassword(password)
  await setCredentials(id, { email, salt, pwHash: hash })

  // Fold the caller's anonymous wallet into the new account on first sign-up.
  const anonId = verify(body?.anon)
  if (anonId && anonId !== id) await mergeWallet(anonId, id)

  return { status: 200, json: { token: sign(id), email, balance: await getBalance(id) } }
}

/** POST /api/auth/login { email, password } -> { token, email, balance } */
export async function handleLogin(headers, body) {
  const email = normalizeEmail(body?.email)
  const password = body?.password || ''
  const id = emailToId(email)
  const acc = await getAccount(id)
  if (!acc || !acc.pwHash)
    return { status: 401, json: { error: 'No account found for that email.' } }
  if (!verifyPassword(password, acc.salt, acc.pwHash))
    return { status: 401, json: { error: 'Incorrect email or password.' } }
  return { status: 200, json: { token: sign(id), email: acc.email, balance: acc.balance } }
}
