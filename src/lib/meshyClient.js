import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MESHY } from '../config.js'

/**
 * Meshy text-to-3D client.
 *
 * Flow:
 *   1. POST a "preview" text-to-3D task with the prompt.
 *   2. Poll the task until it SUCCEEDS (reporting progress along the way).
 *   3. Download the resulting GLB and convert it to a single BufferGeometry
 *      that the viewer can render and the STL exporter can write out.
 *
 * All requests go through MESHY.baseUrl (the Vite dev proxy by default) to
 * dodge browser CORS restrictions.
 */

const headers = () => ({
  Authorization: `Bearer ${MESHY.apiKey}`,
  'Content-Type': 'application/json',
})

async function createTask(prompt) {
  const res = await fetch(`${MESHY.baseUrl}/openapi/v2/text-to-3d`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      mode: 'preview',
      prompt,
      art_style: 'realistic',
      should_remesh: true,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Meshy create failed (${res.status}): ${text || res.statusText}`)
  }
  const data = await res.json()
  // API returns { result: "<taskId>" }
  return data.result || data.id
}

async function getTask(taskId) {
  const res = await fetch(`${MESHY.baseUrl}/openapi/v2/text-to-3d/${taskId}`, {
    headers: headers(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Meshy status failed (${res.status}): ${text || res.statusText}`)
  }
  return res.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Load a GLB ArrayBuffer into a single merged, print-ready BufferGeometry.
 */
async function glbToGeometry(arrayBuffer) {
  const loader = new GLTFLoader()
  const gltf = await loader.parseAsync(arrayBuffer, '')

  const geometries = []
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone()
      g.applyMatrix4(obj.matrixWorld)
      // keep only position so geometries are mergeable
      const keep = new THREE.BufferGeometry()
      keep.setAttribute('position', g.getAttribute('position').clone())
      geometries.push(keep)
    }
  })

  if (geometries.length === 0) {
    throw new Error('The AI model contained no printable meshes.')
  }

  const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false)

  // Orient like our other models: Y-up, centered, sitting on the build plate,
  // and scaled to a sensible default print size (~50mm tall).
  merged.computeBoundingBox()
  const bb = merged.boundingBox
  const size = new THREE.Vector3()
  bb.getSize(size)
  const targetHeight = 6 // matches the scale of built-in shapes in the scene
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const scale = targetHeight / maxDim
  merged.scale(scale, scale, scale)

  merged.computeBoundingBox()
  const bb2 = merged.boundingBox
  const cx = (bb2.min.x + bb2.max.x) / 2
  const cz = (bb2.min.z + bb2.max.z) / 2
  merged.translate(-cx, -bb2.min.y, -cz)
  merged.computeVertexNormals()
  return merged
}

/**
 * Generate a 3D model from a text prompt using Meshy.
 * @param {string} prompt
 * @param {(info: { progress: number, status: string }) => void} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<THREE.BufferGeometry>}
 */
export async function generateWithMeshy(prompt, onProgress, signal) {
  onProgress?.({ progress: 0, status: 'Submitting prompt to AI…' })
  const taskId = await createTask(prompt)

  // Poll until done (Meshy preview usually completes in ~30-90s).
  let task
  for (let i = 0; i < 240; i++) {
    if (signal?.aborted) throw new Error('Cancelled')
    task = await getTask(taskId)
    const status = task.status
    const progress = task.progress ?? 0

    if (status === 'SUCCEEDED') {
      onProgress?.({ progress: 100, status: 'Downloading model…' })
      break
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(task.task_error?.message || `AI generation ${status.toLowerCase()}.`)
    }
    onProgress?.({
      progress,
      status: progress > 0 ? `Sculpting model… ${progress}%` : 'Queued… waiting for AI',
    })
    await sleep(2500)
  }

  if (!task || task.status !== 'SUCCEEDED') {
    throw new Error('AI generation timed out. Please try again.')
  }

  const glbUrl = task.model_urls?.glb
  if (!glbUrl) throw new Error('AI did not return a downloadable model.')

  const glbRes = await fetch(glbUrl)
  if (!glbRes.ok) throw new Error(`Failed to download AI model (${glbRes.status}).`)
  const buffer = await glbRes.arrayBuffer()

  const geometry = await glbToGeometry(buffer)
  onProgress?.({ progress: 100, status: 'Done' })
  return geometry
}
