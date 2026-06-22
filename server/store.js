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

const onNetlify = !!process.env.NETLIFY

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
