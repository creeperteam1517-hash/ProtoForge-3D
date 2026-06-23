/**
 * Key/value store for wallet records, keyed by account id.
 *
 *  - Production (Netlify): Netlify Blobs — durable, no DB to manage.
 *  - Local dev: a JSON file under .data/ (gitignored).
 *
 * Records look like: { balance: number, credited: { [stripeSessionId]: tokens } }
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

// Use Netlify Blobs when running as a deployed function. NETLIFY is only set at
// BUILD time, not in the function runtime, so we also check LAMBDA_TASK_ROOT
// (set in the deployed Lambda, where the filesystem is read-only). Local dev
// (vite or `netlify dev`) has neither and uses the writable .data file store.
const onNetlify = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT)

async function fileBackend() {
  const dir = path.resolve('.data')
  const file = path.join(dir, 'wallets.json')
  const readAll = async () => {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'))
    } catch {
      return {}
    }
  }
  const writeAll = async (obj) => {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(file, JSON.stringify(obj, null, 2))
  }
  return {
    get: async (id) => (await readAll())[id] || null,
    set: async (id, val) => {
      const all = await readAll()
      all[id] = val
      await writeAll(all)
    },
  }
}

async function blobBackend() {
  const { getStore } = await import('@netlify/blobs')
  // Strong consistency isn't available to classic Lambda functions (it needs an
  // uncachedEdgeURL that connectLambda doesn't provide), so we run with the
  // default eventual consistency. To stay correct, the wallet handlers avoid
  // reading a key right after writing it — they return the value they just
  // wrote (see tokens.js / handlers.js).
  const s = getStore('wallets')
  return {
    get: async (id) => await s.get(id, { type: 'json' }),
    set: async (id, val) => await s.setJSON(id, val),
  }
}

let _backend
export function store() {
  if (!_backend) _backend = onNetlify ? blobBackend() : fileBackend()
  return _backend
}
