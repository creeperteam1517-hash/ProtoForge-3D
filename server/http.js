/** Tiny helpers shared by the Netlify function wrappers. */
import { connectLambda } from '@netlify/blobs'

/**
 * Wire up Netlify Blobs for "classic" Lambda-compatible functions. Unlike v2
 * functions, these don't get the Blobs context injected automatically, so each
 * function must call this with its event before touching the wallet store.
 * No-op in local dev (no Lambda event; dev uses the .data file backend anyway).
 */
export const initBlobs = (event) => {
  try {
    connectLambda(event)
  } catch {
    // Not a Lambda runtime (local dev) — ignore.
  }
}

export const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const parseBody = (event) => {
  try {
    return event.body ? JSON.parse(event.body) : {}
  } catch {
    return {}
  }
}

/** Node/Netlify lowercases header keys inconsistently; normalize to lowercase. */
export const lowerHeaders = (h = {}) =>
  Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]))
