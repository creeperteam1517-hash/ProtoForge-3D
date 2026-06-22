import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRIPO } from '../config.js'

/**
 * Tripo3D text-to-3D client (https://platform.tripo3d.ai).
 *
 * Flow:
 *   1. POST a text-to-model task with the prompt.
 *   2. Poll the task until status === 'success' (reporting progress).
 *   3. Download the resulting GLB and convert it to a single BufferGeometry
 *      the viewer can render and the STL exporter can write out.
 *
 * Requests go through TRIPO.baseUrl (/api/tripo), a server-side proxy that
 * injects the secret API key, so no credentials are sent from the browser.
 */

const headers = () => ({
  'Content-Type': 'application/json',
})

async function createTask(prompt) {
  const res = await fetch(`${TRIPO.baseUrl}/v2/openapi/task`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      type: 'text_to_model',
      prompt,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.code !== 0) {
    throw new Error(
      `Tripo create failed (${res.status}): ${data.message || res.statusText}`
    )
  }
  return data.data.task_id
}

async function getTask(taskId) {
  const res = await fetch(`${TRIPO.baseUrl}/v2/openapi/task/${taskId}`, {
    headers: headers(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.code !== 0) {
    throw new Error(
      `Tripo status failed (${res.status}): ${data.message || res.statusText}`
    )
  }
  return data.data
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Load a GLB ArrayBuffer into a single merged, print-ready BufferGeometry. */
async function glbToGeometry(arrayBuffer) {
  const loader = new GLTFLoader()
  const gltf = await loader.parseAsync(arrayBuffer, '')

  const geometries = []
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone()
      g.applyMatrix4(obj.matrixWorld)
      const keep = new THREE.BufferGeometry()
      keep.setAttribute('position', g.getAttribute('position').clone())
      geometries.push(keep)
    }
  })

  if (geometries.length === 0) {
    throw new Error('The AI model contained no printable meshes.')
  }

  const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false)

  // Normalize orientation/size like our other models: centered, on the build
  // plate, scaled to a sensible default print size.
  merged.computeBoundingBox()
  const size = new THREE.Vector3()
  merged.boundingBox.getSize(size)
  const targetHeight = 6
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const scale = targetHeight / maxDim
  merged.scale(scale, scale, scale)

  merged.computeBoundingBox()
  const bb = merged.boundingBox
  const cx = (bb.min.x + bb.max.x) / 2
  const cz = (bb.min.z + bb.max.z) / 2
  merged.translate(-cx, -bb.min.y, -cz)
  merged.computeVertexNormals()
  return merged
}

function extractGlbUrl(task) {
  // Tripo returns model URLs under `output` / `result` depending on version.
  const out = task.output || {}
  const result = task.result || {}
  return (
    out.pbr_model ||
    out.model ||
    out.base_model ||
    result.pbr_model?.url ||
    result.model?.url ||
    null
  )
}

/**
 * Generate a 3D model from a text prompt using Tripo3D.
 * @param {string} prompt
 * @param {(info: { progress: number, status: string }) => void} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<THREE.BufferGeometry>}
 */
export async function generateWithTripo(prompt, onProgress, signal) {
  onProgress?.({ progress: 0, status: 'Submitting prompt to AI…' })
  const taskId = await createTask(prompt)

  let task
  for (let i = 0; i < 240; i++) {
    if (signal?.aborted) throw new Error('Cancelled')
    task = await getTask(taskId)
    const status = task.status
    const progress = task.progress ?? 0

    if (status === 'success') {
      onProgress?.({ progress: 100, status: 'Downloading model…' })
      break
    }
    if (status === 'failed' || status === 'cancelled' || status === 'banned') {
      throw new Error(`AI generation ${status}.`)
    }
    onProgress?.({
      progress,
      status: progress > 0 ? `Sculpting model… ${progress}%` : 'Queued… waiting for AI',
    })
    await sleep(2500)
  }

  if (!task || task.status !== 'success') {
    throw new Error('AI generation timed out. Please try again.')
  }

  const glbUrl = extractGlbUrl(task)
  if (!glbUrl) throw new Error('AI did not return a downloadable model.')

  // The model file lives on a dynamic CDN host that doesn't send CORS headers,
  // so route the download through the dev proxy (see vite.config.js).
  const proxied = `/api/proxy?target=${encodeURIComponent(glbUrl)}`
  const glbRes = await fetch(proxied)
  if (!glbRes.ok) throw new Error(`Failed to download AI model (${glbRes.status}).`)
  const buffer = await glbRes.arrayBuffer()

  const geometry = await glbToGeometry(buffer)
  onProgress?.({ progress: 100, status: 'Done' })
  return geometry
}
