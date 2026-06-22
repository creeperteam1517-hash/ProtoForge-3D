import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

/**
 * Renders a THREE.BufferGeometry with orbit controls, grid build-plate,
 * studio lighting, and interactive transform gizmos for hands-on editing.
 * Auto-frames the model whenever the geometry changes.
 *
 * Props:
 *  - editMode: 'translate' | 'rotate' | 'scale' | null  (which gizmo to show)
 *  - transform: { position, rotation(deg), scale } applied to the mesh
 *  - onTransformChange: called with the live transform while dragging a gizmo
 */
export default function ModelViewer({
  geometry,
  wireframe = false,
  color = '#ff7a00',
  editMode = null,
  transform = null,
  onTransformChange,
}) {
  const mountRef = useRef(null)
  const stateRef = useRef(null)
  // Keep the latest callback in a ref so the one-time setup effect can call it.
  const onTransformChangeRef = useRef(onTransformChange)
  onTransformChangeRef.current = onTransformChange

  // One-time scene setup
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#060e2a')

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(8, 7, 10)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 2
    controls.maxDistance = 60

    // Lighting
    const hemi = new THREE.HemisphereLight(0x9fc0ff, 0x202840, 0.7)
    scene.add(hemi)

    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(8, 14, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 60
    key.shadow.camera.left = -15
    key.shadow.camera.right = 15
    key.shadow.camera.top = 15
    key.shadow.camera.bottom = -15
    scene.add(key)

    const fill = new THREE.DirectionalLight(0x88aaff, 0.6)
    fill.position.set(-10, 5, -6)
    scene.add(fill)

    // Build plate
    const grid = new THREE.GridHelper(30, 30, 0x1f47c4, 0x12297a)
    grid.material.transparent = true
    grid.material.opacity = 0.6
    scene.add(grid)

    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.ShadowMaterial({ opacity: 0.32 })
    )
    plate.rotation.x = -Math.PI / 2
    plate.position.y = -0.001
    plate.receiveShadow = true
    scene.add(plate)

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 0.25,
      roughness: 0.45,
      flatShading: false,
    })

    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)

    // Interactive gizmo for editing the model by hand.
    const gizmo = new TransformControls(camera, renderer.domElement)
    gizmo.setSize(0.9)
    gizmo.attach(mesh)
    gizmo.enabled = false
    gizmo.visible = false
    scene.add(gizmo)

    // While dragging a gizmo, suspend orbiting so the two don't fight.
    gizmo.addEventListener('dragging-changed', (e) => {
      controls.enabled = !e.value
    })

    // Report transform changes back up so React state + STL export stay in sync.
    gizmo.addEventListener('objectChange', () => {
      const cb = onTransformChangeRef.current
      if (!cb) return
      cb({
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        rotation: {
          x: Math.round((mesh.rotation.x * 180) / Math.PI),
          y: Math.round((mesh.rotation.y * 180) / Math.PI),
          z: Math.round((mesh.rotation.z * 180) / Math.PI),
        },
        scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
      })
    })

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    let raf
    const animate = () => {
      raf = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    stateRef.current = { scene, camera, renderer, controls, mesh, material, gizmo }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      gizmo.detach()
      gizmo.dispose()
      controls.dispose()
      renderer.dispose()
      mesh.geometry.dispose()
      material.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Update geometry when it changes + auto-frame the camera
  useEffect(() => {
    const st = stateRef.current
    if (!st || !geometry) return
    const { mesh, camera, controls } = st

    mesh.geometry.dispose()
    mesh.geometry = geometry

    geometry.computeBoundingSphere()
    const { center, radius } = geometry.boundingSphere
    const dist = radius / Math.sin((camera.fov * Math.PI) / 180 / 2)

    controls.target.copy(center)
    const dir = new THREE.Vector3(0.8, 0.65, 1).normalize()
    camera.position.copy(center).addScaledVector(dir, dist * 1.25)
    camera.near = Math.max(0.1, dist / 100)
    camera.far = dist * 100
    camera.updateProjectionMatrix()
    controls.update()
  }, [geometry])

  // Toggle wireframe
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    st.material.wireframe = wireframe
  }, [wireframe])

  // Update color
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    st.material.color.set(color)
  }, [color])

  // Apply edit transforms (position + rotation + per-axis scale) live.
  useEffect(() => {
    const st = stateRef.current
    if (!st || !transform) return
    const { mesh } = st
    const { position, rotation, scale } = transform
    mesh.position.set(position.x, position.y, position.z)
    mesh.rotation.set(
      (rotation.x * Math.PI) / 180,
      (rotation.y * Math.PI) / 180,
      (rotation.z * Math.PI) / 180
    )
    mesh.scale.set(scale.x, scale.y, scale.z)
  }, [transform])

  // Switch the active gizmo (or hide it).
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    const { gizmo } = st
    if (editMode) {
      gizmo.setMode(editMode)
      gizmo.enabled = true
      gizmo.visible = true
    } else {
      gizmo.enabled = false
      gizmo.visible = false
    }
  }, [editMode])

  return <div ref={mountRef} className="h-full w-full" />
}
