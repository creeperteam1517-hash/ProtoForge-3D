/** Tiny helpers shared by the Netlify function wrappers. */

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
