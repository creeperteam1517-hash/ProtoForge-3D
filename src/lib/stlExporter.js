import * as THREE from 'three'

/**
 * Export a THREE.BufferGeometry to a binary STL Blob.
 * The geometry is expected to be non-indexed or indexed; we handle both.
 * Coordinates are written as-is (units treated as millimetres for printing).
 */
export function geometryToBinarySTL(geometry, transform = null) {
  let geo = geometry.index ? geometry.toNonIndexed() : geometry.clone()

  // Bake editor transforms (position + rotation in degrees + per-axis scale)
  // into the exported geometry so the STL matches exactly what the user sees.
  if (transform) {
    const {
      position = { x: 0, y: 0, z: 0 },
      rotation = { x: 0, y: 0, z: 0 },
      scale = { x: 1, y: 1, z: 1 },
    } = transform

    // Support a legacy uniform-scale number for backwards compatibility.
    const s =
      typeof scale === 'number'
        ? { x: scale, y: scale, z: scale }
        : scale

    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(position.x, position.y, position.z),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (rotation.x * Math.PI) / 180,
          (rotation.y * Math.PI) / 180,
          (rotation.z * Math.PI) / 180,
          'XYZ'
        )
      ),
      new THREE.Vector3(s.x, s.y, s.z)
    )
    geo.applyMatrix4(m)

    // Re-drop onto the build plate so the model isn't floating/sunken.
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const cx = (bb.min.x + bb.max.x) / 2
    const cz = (bb.min.z + bb.max.z) / 2
    geo.translate(-cx, -bb.min.y, -cz)
  }

  const position = geo.getAttribute('position')
  const triangleCount = position.count / 3

  // 80-byte header + 4-byte triangle count + 50 bytes per triangle
  const bufferSize = 84 + triangleCount * 50
  const arrayBuffer = new ArrayBuffer(bufferSize)
  const dv = new DataView(arrayBuffer)

  // header (80 bytes) left as zeros, then little-endian triangle count
  let offset = 80
  dv.setUint32(offset, triangleCount, true)
  offset += 4

  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const cb = new THREE.Vector3()
  const ab = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 3) {
    vA.fromBufferAttribute(position, i)
    vB.fromBufferAttribute(position, i + 1)
    vC.fromBufferAttribute(position, i + 2)

    // face normal
    cb.subVectors(vC, vB)
    ab.subVectors(vA, vB)
    cb.cross(ab).normalize()

    dv.setFloat32(offset, cb.x, true); offset += 4
    dv.setFloat32(offset, cb.y, true); offset += 4
    dv.setFloat32(offset, cb.z, true); offset += 4

    for (const v of [vA, vB, vC]) {
      dv.setFloat32(offset, v.x, true); offset += 4
      dv.setFloat32(offset, v.y, true); offset += 4
      dv.setFloat32(offset, v.z, true); offset += 4
    }

    dv.setUint16(offset, 0, true) // attribute byte count
    offset += 2
  }

  return new Blob([arrayBuffer], { type: 'application/octet-stream' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slugify(text) {
  return (
    (text || 'model')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'model'
  )
}
