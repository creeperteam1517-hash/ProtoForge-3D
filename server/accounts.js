/**
 * Anonymous account identity.
 *
 * The browser holds a signed session token ("<id>.<hmac>"). Only the server
 * (which knows TOKEN_SECRET) can mint or verify one, so a client cannot forge
 * an account id — the balance stays server-authoritative.
 */
import crypto from 'node:crypto'

const SECRET = process.env.TOKEN_SECRET || 'dev-insecure-secret-change-me'

const mac = (id) =>
  crypto.createHmac('sha256', SECRET).update(id).digest('hex').slice(0, 32)

export function newId() {
  return crypto.randomBytes(16).toString('hex')
}

export function sign(id) {
  return `${id}.${mac(id)}`
}

/** Returns the account id if the token is authentic, else null. */
export function verify(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const id = token.slice(0, dot)
  const got = token.slice(dot + 1)
  const want = mac(id)
  const a = Buffer.from(got)
  const b = Buffer.from(want)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return id
}

const blobMac = (body) =>
  crypto.createHmac('sha256', SECRET).update(body).digest('base64url').slice(0, 32)

/** Sign an arbitrary object into a self-contained, tamper-proof string (used
 * as the OAuth `state` so the flow stays stateless). */
export function signState(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${body}.${blobMac(body)}`
}

/** Verify + decode a signed state. Returns the object, or null if invalid/expired. */
export function verifyState(state, maxAgeMs = 10 * 60 * 1000) {
  if (!state || typeof state !== 'string') return null
  const dot = state.lastIndexOf('.')
  if (dot < 1) return null
  const body = state.slice(0, dot)
  const got = state.slice(dot + 1)
  const want = blobMac(body)
  const a = Buffer.from(got)
  const b = Buffer.from(want)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  let obj
  try {
    obj = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (maxAgeMs && obj.t && Date.now() - obj.t > maxAgeMs) return null
  return obj
}
