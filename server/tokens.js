/**
 * Wallet operations on top of the store. All balance changes happen here so the
 * server stays the single source of truth.
 */
import { store } from './store.js'
import { STARTER_TOKENS } from './economy.js'

const blank = () => ({ balance: STARTER_TOKENS, credited: {} })

/** Create the account record (with starter grant) if it doesn't exist yet. */
export async function ensureAccount(id) {
  const s = await store()
  if (!(await s.get(id))) await s.set(id, blank())
}

export async function getBalance(id) {
  const acc = await (await store()).get(id)
  return acc ? acc.balance : 0
}

export async function getAccount(id) {
  return await (await store()).get(id)
}

/** Store email + password credentials on an account (sign-up). */
export async function setCredentials(id, { email, salt, pwHash }) {
  const s = await store()
  const acc = (await s.get(id)) || blank()
  acc.email = email
  acc.salt = salt
  acc.pwHash = pwHash
  await s.set(id, acc)
}

/** Move all tokens from one wallet into another (used to fold an anonymous
 * wallet into a logged-in account). Zeroes the source so it can't merge twice. */
export async function mergeWallet(fromId, toId) {
  if (!fromId || fromId === toId) return
  const s = await store()
  const from = await s.get(fromId)
  if (!from || !from.balance) return
  const to = (await s.get(toId)) || blank()
  to.balance += from.balance
  from.balance = 0
  await s.set(toId, to)
  await s.set(fromId, from)
}

/**
 * Add tokens. If `sessionId` is given, the credit is idempotent — replaying the
 * same Stripe session never double-credits.
 */
export async function credit(id, tokens, sessionId) {
  const s = await store()
  const acc = (await s.get(id)) || blank()
  if (sessionId) {
    if (acc.credited[sessionId]) return acc.balance
    acc.credited[sessionId] = tokens
  }
  acc.balance += Math.max(0, Math.floor(tokens))
  await s.set(id, acc)
  return acc.balance
}

/** Spend `tokens`. Returns { ok, balance }; ok=false if the balance is short. */
export async function spend(id, tokens) {
  const s = await store()
  const acc = (await s.get(id)) || blank()
  if (acc.balance < tokens) return { ok: false, balance: acc.balance }
  acc.balance -= tokens
  await s.set(id, acc)
  return { ok: true, balance: acc.balance }
}
