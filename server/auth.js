/**
 * Email + password auth helpers. Passwords are hashed with scrypt + a random
 * per-user salt; we only ever store the salt and hash, never the password.
 */
import crypto from 'node:crypto'

export const normalizeEmail = (e) =>
  typeof e === 'string' ? e.trim().toLowerCase() : ''

export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

/** Deterministic account id for an email (so the same email = same wallet). */
export const emailToId = (email) =>
  'e_' + crypto.createHash('sha256').update(email).digest('hex')

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

export function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  const a = Buffer.from(test)
  const b = Buffer.from(hash)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
