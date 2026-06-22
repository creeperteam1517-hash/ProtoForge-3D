import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * AI 3D Forge - Procedural model generator.
 *
 * Interprets a natural-language prompt and assembles a mesh from parametric
 * primitives. The output is a single merged, indexed-free BufferGeometry that
 * can be exported directly to STL and printed.
 *
 * Deterministic-with-variation: same prompt + seed yields the same model;
 * changing the seed (re-roll) gives a fresh interpretation.
 */

// ----------------------------- RNG -----------------------------------------

function makeRng(seed) {
  // Mulberry32 - small, fast, deterministic PRNG.
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ------------------------- geometry helpers --------------------------------

function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4()
  const t = new THREE.Matrix4().makeTranslation(x, y, z)
  const rxm = new THREE.Matrix4().makeRotationX(rx)
  const rym = new THREE.Matrix4().makeRotationY(ry)
  const rzm = new THREE.Matrix4().makeRotationZ(rz)
  const s = new THREE.Matrix4().makeScale(sx, sy, sz)
  m.multiply(t).multiply(rzm).multiply(rym).multiply(rxm).multiply(s)
  geo.applyMatrix4(m)
  return geo
}

// Quality presets control mesh resolution (segment counts). Higher quality =
// smoother curves and larger STL files. `_detail` is set per-generation.
export const QUALITY = {
  low: { label: 'Draft', radial: 16, height: 1, ring: 10, tubular: 32, mult: 0.6 },
  medium: { label: 'Standard', radial: 32, height: 2, ring: 16, tubular: 56, mult: 1 },
  high: { label: 'High', radial: 64, height: 3, ring: 24, tubular: 96, mult: 1.4 },
  ultra: { label: 'Ultra', radial: 128, height: 4, ring: 40, tubular: 160, mult: 1.8 },
}

let _detail = QUALITY.high

const sphere = (r, opts) =>
  place(new THREE.SphereGeometry(r, _detail.radial, Math.max(8, Math.round(_detail.radial * 0.75))), opts)
const box = (w, h, d, opts) =>
  place(new THREE.BoxGeometry(w, h, d, _detail.height, _detail.height, _detail.height), opts)
const cyl = (rt, rb, h, opts) =>
  place(new THREE.CylinderGeometry(rt, rb, h, _detail.radial, _detail.height), opts)
const cone = (r, h, opts) =>
  place(new THREE.ConeGeometry(r, h, _detail.radial, _detail.height), opts)
const torus = (r, tube, opts) =>
  place(new THREE.TorusGeometry(r, tube, _detail.ring, _detail.tubular), opts)
const pyramid = (r, h, opts) => place(new THREE.ConeGeometry(r, h, 4, 1), opts)
const tetra = (r, opts) => place(new THREE.TetrahedronGeometry(r, 0), opts)
const octa = (r, opts) => place(new THREE.OctahedronGeometry(r, 0), opts)
const dodeca = (r, opts) => place(new THREE.DodecahedronGeometry(r, 0), opts)
const icosa = (r, opts) => place(new THREE.IcosahedronGeometry(r, _detail.mult >= 1.4 ? 1 : 0), opts)

function combine(parts) {
  const cleaned = parts.filter(Boolean).map((g) => {
    const ng = g.index ? g.toNonIndexed() : g
    // Drop UVs (not needed) but KEEP each primitive's own normals: spheres and
    // cylinders ship with smooth normals, boxes/polyhedra with flat ones. This
    // keeps curved surfaces looking smooth instead of faceted/triangulated.
    ng.deleteAttribute('uv')
    if (!ng.getAttribute('normal')) ng.computeVertexNormals()
    return ng
  })
  // useGroups=false; all parts share position+normal so they merge cleanly.
  return mergeGeometries(cleaned, false)
}

// ----------------------------- recipes -------------------------------------
// Each recipe returns an array of positioned geometries.

const RECIPES = {
  // ---- pure primitives (accurate, single-shape) ----
  sphere() {
    return [sphere(2, { y: 2 })]
  },
  cube() {
    return [box(3, 3, 3, { y: 1.5 })]
  },
  cylinder() {
    return [cyl(1.5, 1.5, 3.5, { y: 1.75 })]
  },
  cone() {
    return [cone(1.8, 3.5, { y: 1.75 })]
  },
  pyramid() {
    return [pyramid(2, 3, { y: 1.5, ry: Math.PI / 4 })]
  },
  torus() {
    return [torus(1.6, 0.55, { y: 0.55, rx: Math.PI / 2 })]
  },
  tetrahedron() {
    return [tetra(2.2, { y: 1.4 })]
  },
  octahedron() {
    return [octa(2.2, { y: 2.2 })]
  },
  dodecahedron() {
    return [dodeca(2.2, { y: 2 })]
  },
  icosahedron() {
    return [icosa(2.2, { y: 2.1 })]
  },

  snowman(rng) {
    const parts = []
    parts.push(sphere(1.4, { y: 1.4 }))
    parts.push(sphere(1.0, { y: 3.0 }))
    parts.push(sphere(0.7, { y: 4.2 }))
    // nose
    parts.push(cone(0.12, 0.6, { y: 4.25, z: 0.65, rx: Math.PI / 2 }))
    // hat
    parts.push(cyl(0.5, 0.5, 0.7, { y: 4.95 }))
    parts.push(cyl(0.75, 0.75, 0.12, { y: 4.66 }))
    // arms
    parts.push(cyl(0.06, 0.06, 1.4, { y: 3.0, x: 1.1, rz: Math.PI / 2.2 }))
    parts.push(cyl(0.06, 0.06, 1.4, { y: 3.0, x: -1.1, rz: -Math.PI / 2.2 }))
    return parts
  },

  rocket(rng) {
    const parts = []
    const bodyH = 4
    parts.push(cyl(0.8, 0.8, bodyH, { y: bodyH / 2 + 0.6 }))
    parts.push(cone(0.8, 1.6, { y: bodyH + 0.6 + 0.8 }))
    // fins
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      parts.push(
        box(0.12, 1.4, 0.9, {
          x: Math.cos(a) * 0.85,
          z: Math.sin(a) * 0.85,
          y: 0.9,
          ry: -a,
        })
      )
    }
    // exhaust nozzle
    parts.push(cyl(0.55, 0.8, 0.6, { y: 0.3 }))
    // window
    parts.push(sphere(0.32, { y: bodyH, z: 0.7 }))
    return parts
  },

  mug(rng) {
    const parts = []
    const r = 1.2
    const h = 2.4
    // outer wall + base as a thick cylinder, then bore a recess by stacking
    parts.push(cyl(r, r, h, { y: h / 2 }))
    // hollow look: inner negative not possible without CSG, so add rim ring
    parts.push(torus(r - 0.08, 0.08, { y: h, rx: Math.PI / 2 }))
    // handle
    parts.push(torus(0.55, 0.16, { x: r + 0.35, y: h / 2, ry: Math.PI / 2 }))
    return parts
  },

  tree(rng) {
    const parts = []
    parts.push(cyl(0.35, 0.45, 1.6, { y: 0.8 }))
    parts.push(cone(1.4, 1.8, { y: 2.2 }))
    parts.push(cone(1.1, 1.6, { y: 3.1 }))
    parts.push(cone(0.8, 1.4, { y: 3.9 }))
    return parts
  },

  house(rng) {
    const parts = []
    parts.push(box(3, 2, 2.4, { y: 1 }))
    // roof
    parts.push(cone(2.2, 1.6, { y: 2.8, ry: Math.PI / 4 }))
    // chimney
    parts.push(box(0.4, 1.0, 0.4, { x: 0.8, y: 3.0, z: 0.4 }))
    // door
    parts.push(box(0.7, 1.2, 0.1, { y: 0.6, z: 1.25 }))
    return parts
  },

  car(rng) {
    const parts = []
    parts.push(box(4, 0.9, 1.8, { y: 0.95 }))
    parts.push(box(2.2, 0.9, 1.6, { y: 1.75, x: -0.2 }))
    // wheels
    const wy = 0.55
    const positions = [
      [1.3, wy, 0.95],
      [1.3, wy, -0.95],
      [-1.3, wy, 0.95],
      [-1.3, wy, -0.95],
    ]
    for (const [x, y, z] of positions) {
      parts.push(cyl(0.55, 0.55, 0.35, { x, y, z, rx: Math.PI / 2 }))
    }
    return parts
  },

  robot(rng) {
    const parts = []
    parts.push(box(1.6, 2, 1, { y: 2.2 })) // torso
    parts.push(box(1.1, 1.0, 1.0, { y: 3.7 })) // head
    parts.push(cyl(0.06, 0.06, 0.6, { y: 4.5 })) // antenna
    parts.push(sphere(0.12, { y: 4.85 }))
    // eyes
    parts.push(sphere(0.13, { y: 3.8, z: 0.5, x: 0.3 }))
    parts.push(sphere(0.13, { y: 3.8, z: 0.5, x: -0.3 }))
    // arms
    parts.push(box(0.4, 1.6, 0.4, { x: 1.2, y: 2.2 }))
    parts.push(box(0.4, 1.6, 0.4, { x: -1.2, y: 2.2 }))
    // legs
    parts.push(box(0.5, 1.4, 0.5, { x: 0.45, y: 0.7 }))
    parts.push(box(0.5, 1.4, 0.5, { x: -0.45, y: 0.7 }))
    return parts
  },

  ring(rng) {
    const parts = []
    parts.push(torus(1.1, 0.35, { rx: Math.PI / 2 }))
    // gem
    parts.push(cone(0.5, 0.7, { y: 0.85 }))
    parts.push(cone(0.5, 0.4, { y: 0.45, rx: Math.PI }))
    return parts
  },

  vase(rng) {
    const parts = []
    const pts = []
    const segs = 12
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      const y = t * 3.4
      const radius =
        0.5 +
        Math.sin(t * Math.PI) * 1.0 +
        Math.sin(t * Math.PI * 2 + 1) * 0.15
      pts.push(new THREE.Vector2(Math.max(0.18, radius), y))
    }
    const lathe = new THREE.LatheGeometry(pts, 48)
    parts.push(lathe)
    return parts
  },

  gear(rng) {
    const parts = []
    const teeth = 12
    parts.push(cyl(1.2, 1.2, 0.5, {}))
    parts.push(cyl(0.35, 0.35, 0.6, {})) // hub bore marker
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2
      parts.push(
        box(0.35, 0.5, 0.45, {
          x: Math.cos(a) * 1.35,
          z: Math.sin(a) * 1.35,
          ry: -a,
        })
      )
    }
    return parts
  },

  heart(rng) {
    const shape = new THREE.Shape()
    const x = 0
    const y = 0
    shape.moveTo(x + 0.5, y + 0.5)
    shape.bezierCurveTo(x + 0.5, y + 0.5, x + 0.4, y, x, y)
    shape.bezierCurveTo(x - 0.6, y, x - 0.6, y + 0.7, x - 0.6, y + 0.7)
    shape.bezierCurveTo(x - 0.6, y + 1.1, x - 0.3, y + 1.54, x + 0.5, y + 1.9)
    shape.bezierCurveTo(x + 1.2, y + 1.54, x + 1.6, y + 1.1, x + 1.6, y + 0.7)
    shape.bezierCurveTo(x + 1.6, y + 0.7, x + 1.6, y, x + 1.0, y)
    shape.bezierCurveTo(x + 0.7, y, x + 0.5, y + 0.5, x + 0.5, y + 0.5)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.6,
      bevelEnabled: true,
      bevelSize: 0.1,
      bevelThickness: 0.1,
      bevelSegments: 3,
    })
    geo.scale(1.5, 1.5, 1.5)
    geo.center()
    return [geo]
  },

  // ---- free "AI" composite creatures & objects ----
  dog() {
    const p = []
    // body
    p.push(cyl(0.7, 0.7, 2.2, { y: 1.4, z: 0, rz: Math.PI / 2 }))
    p.push(sphere(0.72, { y: 1.4, x: 1.1 }))
    p.push(sphere(0.72, { y: 1.4, x: -1.1 }))
    // head
    p.push(sphere(0.62, { y: 2.1, x: 1.5 }))
    // snout
    p.push(cyl(0.22, 0.3, 0.6, { y: 1.95, x: 2.05, rz: Math.PI / 2 }))
    p.push(sphere(0.12, { y: 1.95, x: 2.4 }))
    // ears
    p.push(cone(0.18, 0.45, { y: 2.6, x: 1.35, z: 0.3, rx: 0.3 }))
    p.push(cone(0.18, 0.45, { y: 2.6, x: 1.35, z: -0.3, rx: -0.3 }))
    // legs
    for (const [x, z] of [[0.8, 0.4], [0.8, -0.4], [-0.8, 0.4], [-0.8, -0.4]]) {
      p.push(cyl(0.16, 0.16, 1.0, { y: 0.5, x, z }))
    }
    // tail
    p.push(cyl(0.12, 0.18, 0.9, { y: 1.7, x: -1.6, rz: -0.8 }))
    return p
  },

  cat() {
    const p = []
    p.push(cyl(0.55, 0.55, 1.8, { y: 1.1, rz: Math.PI / 2 }))
    p.push(sphere(0.6, { y: 1.1, x: 0.9 }))
    // head
    p.push(sphere(0.5, { y: 1.7, x: 1.15 }))
    // ears (triangular)
    p.push(cone(0.16, 0.4, { y: 2.2, x: 1.0, z: 0.25 }))
    p.push(cone(0.16, 0.4, { y: 2.2, x: 1.0, z: -0.25 }))
    // legs
    for (const [x, z] of [[0.6, 0.32], [0.6, -0.32], [-0.6, 0.32], [-0.6, -0.32]]) {
      p.push(cyl(0.13, 0.13, 0.8, { y: 0.4, x, z }))
    }
    // long curved tail
    p.push(cyl(0.1, 0.14, 1.2, { y: 1.5, x: -1.3, rz: -1.2 }))
    p.push(sphere(0.12, { y: 2.0, x: -1.7 }))
    return p
  },

  rabbit() {
    const p = []
    p.push(sphere(0.8, { y: 0.85 })) // body
    p.push(sphere(0.55, { y: 1.7 })) // head
    // tall ears
    p.push(cyl(0.14, 0.18, 1.2, { y: 2.5, x: 0.18, z: 0.1, rx: 0.12 }))
    p.push(cyl(0.14, 0.18, 1.2, { y: 2.5, x: -0.18, z: 0.1, rx: 0.12 }))
    // feet
    p.push(box(0.6, 0.22, 0.35, { y: 0.18, z: 0.45 }))
    // tail
    p.push(sphere(0.22, { y: 0.9, z: -0.8 }))
    return p
  },

  bird() {
    const p = []
    p.push(sphere(0.7, { y: 1.0, sx: 1.3 })) // body
    p.push(sphere(0.42, { y: 1.6, x: 0.7 })) // head
    p.push(cone(0.16, 0.5, { y: 1.6, x: 1.2, rz: -Math.PI / 2 })) // beak
    // wings
    p.push(box(0.1, 0.5, 0.9, { y: 1.1, z: 0.6, rx: 0.3 }))
    p.push(box(0.1, 0.5, 0.9, { y: 1.1, z: -0.6, rx: -0.3 }))
    // tail
    p.push(cone(0.4, 0.9, { y: 1.0, x: -0.9, rz: Math.PI / 2 }))
    // legs
    p.push(cyl(0.07, 0.07, 0.6, { y: 0.4, x: 0.15 }))
    p.push(cyl(0.07, 0.07, 0.6, { y: 0.4, x: -0.15 }))
    return p
  },

  fish() {
    const p = []
    p.push(sphere(1.0, { y: 1.2, sx: 1.6, sy: 0.9 })) // body
    p.push(cone(0.7, 1.0, { y: 1.2, x: -1.7, rz: Math.PI / 2 })) // tail
    p.push(cone(0.4, 0.6, { y: 2.0, z: 0, rx: 0 })) // top fin
    p.push(sphere(0.1, { y: 1.4, x: 1.2, z: 0.45 })) // eye
    p.push(sphere(0.1, { y: 1.4, x: 1.2, z: -0.45 }))
    return p
  },

  horse() {
    const p = []
    p.push(cyl(0.7, 0.7, 2.4, { y: 2.0, rz: Math.PI / 2 })) // body
    // neck + head
    p.push(cyl(0.32, 0.4, 1.2, { y: 2.7, x: 1.2, rz: -0.7 }))
    p.push(box(0.4, 0.5, 0.9, { y: 3.3, x: 1.7 }))
    // legs
    for (const [x, z] of [[0.9, 0.4], [0.9, -0.4], [-0.9, 0.4], [-0.9, -0.4]]) {
      p.push(cyl(0.18, 0.18, 1.7, { y: 0.85, x, z }))
    }
    // tail
    p.push(cyl(0.12, 0.2, 1.2, { y: 2.0, x: -1.5, rz: -1.0 }))
    return p
  },

  person() {
    const p = []
    p.push(cyl(0.5, 0.6, 1.6, { y: 1.9 })) // torso
    p.push(sphere(0.5, { y: 3.1 })) // head
    // arms
    p.push(cyl(0.16, 0.16, 1.5, { y: 1.9, x: 0.75, rz: 0.15 }))
    p.push(cyl(0.16, 0.16, 1.5, { y: 1.9, x: -0.75, rz: -0.15 }))
    // legs
    p.push(cyl(0.2, 0.2, 1.6, { y: 0.8, x: 0.28 }))
    p.push(cyl(0.2, 0.2, 1.6, { y: 0.8, x: -0.28 }))
    return p
  },

  flower() {
    const p = []
    p.push(cyl(0.1, 0.12, 2.6, { y: 1.3 })) // stem
    p.push(sphere(0.45, { y: 2.7 })) // center
    // petals
    const petals = 6
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2
      p.push(
        sphere(0.32, { y: 2.7, x: Math.cos(a) * 0.7, z: Math.sin(a) * 0.7, sy: 0.5 })
      )
    }
    // leaf
    p.push(sphere(0.3, { y: 1.2, x: 0.5, sx: 1.6, sy: 0.3 }))
    return p
  },

  mushroom() {
    const p = []
    p.push(cyl(0.4, 0.5, 1.6, { y: 0.8 })) // stem
    p.push(sphere(1.1, { y: 1.6, sy: 0.6 })) // cap
    return p
  },

  star() {
    const p = []
    const points = 5
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2 - Math.PI / 2
      p.push(
        box(0.5, 1.6, 0.4, {
          y: 1.2,
          x: Math.cos(a) * 0.7,
          z: Math.sin(a) * 0.7,
          rz: -a + Math.PI / 2,
        })
      )
    }
    p.push(cyl(0.8, 0.8, 0.4, { y: 1.2, rx: Math.PI / 2 }))
    return p
  },

  dragon() {
    const p = []
    // serpentine body
    p.push(cyl(0.6, 0.8, 2.6, { y: 1.6, rz: Math.PI / 2 }))
    p.push(sphere(0.7, { y: 1.6, x: 1.2 }))
    // neck + head
    p.push(cyl(0.32, 0.45, 1.4, { y: 2.5, x: 1.5, rz: -0.7 }))
    p.push(sphere(0.5, { y: 3.2, x: 2.0 }))
    p.push(cyl(0.18, 0.28, 0.7, { y: 3.05, x: 2.5, rz: Math.PI / 2.2 }))
    // horns
    p.push(cone(0.1, 0.5, { y: 3.7, x: 1.85, z: 0.18, rx: -0.3 }))
    p.push(cone(0.1, 0.5, { y: 3.7, x: 1.85, z: -0.18, rx: 0.3 }))
    // wings
    p.push(box(0.08, 1.6, 1.8, { y: 2.5, x: -0.1, z: 0.7, rx: 0.5 }))
    p.push(box(0.08, 1.6, 1.8, { y: 2.5, x: -0.1, z: -0.7, rx: -0.5 }))
    // legs
    for (const [x, z] of [[0.6, 0.4], [0.6, -0.4], [-0.5, 0.4], [-0.5, -0.4]]) {
      p.push(cyl(0.16, 0.16, 1.0, { y: 0.5, x, z }))
    }
    // long tail (tapering segments)
    p.push(cyl(0.18, 0.4, 1.4, { y: 1.4, x: -1.7, rz: -0.9 }))
    p.push(cone(0.18, 0.6, { y: 0.7, x: -2.5, rz: -1.2 }))
    return p
  },

  dinosaur() {
    const p = []
    p.push(sphere(1.0, { y: 1.6, sx: 1.7, sy: 1.1 })) // body
    // neck + small head (brontosaurus-ish)
    p.push(cyl(0.3, 0.4, 1.6, { y: 2.6, x: 1.3, rz: -0.6 }))
    p.push(sphere(0.4, { y: 3.4, x: 1.9 }))
    // thick legs
    for (const [x, z] of [[0.7, 0.5], [0.7, -0.5], [-0.7, 0.5], [-0.7, -0.5]]) {
      p.push(cyl(0.28, 0.32, 1.4, { y: 0.7, x, z }))
    }
    // long tail
    p.push(cyl(0.2, 0.5, 2.0, { y: 1.5, x: -1.9, rz: -0.5 }))
    return p
  },

  elephant() {
    const p = []
    p.push(sphere(1.2, { y: 1.8, sx: 1.3 })) // body
    p.push(sphere(0.8, { y: 2.0, x: 1.3 })) // head
    // trunk
    p.push(cyl(0.18, 0.3, 1.4, { y: 1.4, x: 1.9, rz: 0.5 }))
    // ears
    p.push(sphere(0.5, { y: 2.2, x: 1.1, z: 0.6, sx: 0.3 }))
    p.push(sphere(0.5, { y: 2.2, x: 1.1, z: -0.6, sx: 0.3 }))
    // tusks
    p.push(cone(0.07, 0.6, { y: 1.5, x: 1.9, z: 0.25, rz: Math.PI / 2 }))
    p.push(cone(0.07, 0.6, { y: 1.5, x: 1.9, z: -0.25, rz: Math.PI / 2 }))
    // legs
    for (const [x, z] of [[0.6, 0.5], [0.6, -0.5], [-0.7, 0.5], [-0.7, -0.5]]) {
      p.push(cyl(0.32, 0.34, 1.4, { y: 0.7, x, z }))
    }
    return p
  },

  duck() {
    const p = []
    p.push(sphere(0.9, { y: 1.0, sx: 1.3 })) // body
    p.push(sphere(0.45, { y: 1.7, x: 0.8 })) // head
    p.push(box(0.4, 0.12, 0.3, { y: 1.6, x: 1.25 })) // bill
    p.push(cone(0.45, 0.8, { y: 1.1, x: -0.9, rz: Math.PI / 2.5 })) // tail
    return p
  },

  snake() {
    const p = []
    // coiled body via stacked rings of decreasing radius
    let y = 0.3
    let radius = 1.3
    for (let i = 0; i < 5; i++) {
      p.push(torus(radius, 0.28, { y, rx: Math.PI / 2 }))
      y += 0.42
      radius *= 0.8
    }
    p.push(sphere(0.34, { y: y + 0.1, x: radius })) // head
    return p
  },

  airplane() {
    const p = []
    p.push(cyl(0.4, 0.4, 4.0, { y: 1.5, rz: Math.PI / 2 })) // fuselage
    p.push(cone(0.4, 0.9, { y: 1.5, x: 2.4, rz: -Math.PI / 2 })) // nose
    p.push(box(3.6, 0.12, 0.9, { y: 1.5 })) // main wings
    p.push(box(1.0, 0.1, 0.5, { y: 1.7, x: -1.8 })) // tail wing
    p.push(box(0.1, 0.7, 0.5, { y: 1.9, x: -1.8 })) // vertical stabilizer
    return p
  },

  boat() {
    const p = []
    // hull (half-cylinder-ish via scaled sphere bottom + box)
    p.push(sphere(1.4, { y: 0.9, sx: 1.6, sy: 0.5 }))
    p.push(box(3.6, 0.7, 1.4, { y: 1.3 }))
    // mast + sail
    p.push(cyl(0.08, 0.08, 2.6, { y: 2.6 }))
    p.push(box(0.06, 1.6, 1.2, { y: 2.7, x: 0.35, z: 0 }))
    return p
  },

  // Fallback for unrecognized prompts: a deliberate faceted "crystal" sculpture
  // (looks intentional rather than a random blob), seeded by the prompt so each
  // prompt is unique but reproducible.
  abstract(rng) {
    const p = []
    // A central faceted gem (twisted bipyramid) reads as an intentional object.
    const facets = 5 + Math.floor(rng() * 4)
    const topH = 1.6 + rng() * 1.2
    const botH = 1.0 + rng() * 0.8
    const r = 1.1 + rng() * 0.5
    p.push(place(new THREE.ConeGeometry(r, topH, facets, 1), { y: botH + topH / 2 }))
    p.push(place(new THREE.ConeGeometry(r, botH, facets, 1), { y: botH / 2, rx: Math.PI }))
    // A ring of small orbiting crystals adds richness.
    const orbiters = 3 + Math.floor(rng() * 3)
    for (let i = 0; i < orbiters; i++) {
      const a = (i / orbiters) * Math.PI * 2 + rng()
      const rr = 0.35 + rng() * 0.35
      p.push(
        place(new THREE.OctahedronGeometry(rr, 0), {
          x: Math.cos(a) * (r + 0.7),
          z: Math.sin(a) * (r + 0.7),
          y: botH + rng() * 0.6,
          ry: a,
        })
      )
    }
    // A base plinth so it stands cleanly.
    p.push(cyl(r * 1.3, r * 1.5, 0.3, { y: 0.15 }))
    return p
  },
}

// keyword -> recipe mapping. Primitives are checked first and matched on whole
// words so "a sphere" reliably produces an actual sphere.
const KEYWORDS = [
  // pure primitives
  [['sphere', 'ball', 'orb', 'globe'], 'sphere'],
  [['cube', 'box', 'block', 'square'], 'cube'],
  [['cylinder', 'tube', 'pipe', 'rod', 'pillar', 'column'], 'cylinder'],
  [['cone'], 'cone'],
  [['pyramid'], 'pyramid'],
  [['torus', 'donut', 'doughnut'], 'torus'],
  [['tetrahedron', 'tetra'], 'tetrahedron'],
  [['octahedron', 'octa'], 'octahedron'],
  [['dodecahedron', 'dodeca'], 'dodecahedron'],
  [['icosahedron', 'icosa', 'd20'], 'icosahedron'],
  // composite objects
  [['snowman', 'snow man'], 'snowman'],
  [['rocket', 'spaceship', 'space ship', 'missile'], 'rocket'],
  [['mug', 'cup', 'coffee'], 'mug'],
  [['tree', 'pine', 'christmas'], 'tree'],
  [['house', 'home', 'cabin', 'building'], 'house'],
  [['car', 'vehicle', 'truck', 'auto'], 'car'],
  [['robot', 'android', 'bot', 'mech'], 'robot'],
  [['ring', 'jewel', 'diamond'], 'ring'],
  [['vase', 'pot', 'jar', 'urn'], 'vase'],
  [['gear', 'cog', 'sprocket', 'wheel'], 'gear'],
  [['heart', 'love', 'valentine'], 'heart'],
  // creatures & nature (free "AI" composites)
  [['dog', 'puppy', 'doggo', 'hound'], 'dog'],
  [['cat', 'kitten', 'kitty'], 'cat'],
  [['rabbit', 'bunny', 'hare'], 'rabbit'],
  [['bird', 'birdie', 'sparrow', 'robin', 'parrot'], 'bird'],
  [['fish', 'goldfish', 'shark'], 'fish'],
  [['horse', 'pony', 'foal'], 'horse'],
  [['person', 'human', 'man', 'woman', 'figure', 'guy'], 'person'],
  [['flower', 'rose', 'daisy', 'tulip', 'bloom'], 'flower'],
  [['mushroom', 'toadstool'], 'mushroom'],
  [['star'], 'star'],
  [['dragon', 'wyvern'], 'dragon'],
  [['dinosaur', 'dino', 'brontosaurus', 'trex', 't-rex'], 'dinosaur'],
  [['elephant'], 'elephant'],
  [['duck', 'duckling'], 'duck'],
  [['snake', 'serpent', 'cobra'], 'snake'],
  [['airplane', 'aeroplane', 'plane', 'jet', 'aircraft'], 'airplane'],
  [['boat', 'ship', 'sailboat', 'yacht'], 'boat'],
]

function matchesWord(text, word) {
  // whole-word / phrase match using boundaries
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
}

export function pickRecipe(prompt) {
  const p = prompt.toLowerCase()
  for (const [words, recipe] of KEYWORDS) {
    if (words.some((w) => matchesWord(p, w))) return recipe
  }
  return 'abstract'
}

// primitives produce a single exact shape and ignore stylistic seed variation
const PRIMITIVE_RECIPES = new Set([
  'sphere', 'cube', 'cylinder', 'cone', 'pyramid', 'torus',
  'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron',
])

/**
 * Generate a model from a prompt.
 * @param {string} prompt
 * @param {object} [options]
 * @param {number} [options.seed] optional seed; defaults to a hash of the prompt
 * @param {string} [options.quality] one of 'low' | 'medium' | 'high' | 'ultra'
 * @returns {{ geometry: THREE.BufferGeometry, recipe: string, seed: number, quality: string }}
 */
export function generateModel(prompt, options = {}) {
  const { seed, quality = 'medium' } = options
  _detail = QUALITY[quality] || QUALITY.medium

  const cleanPrompt = (prompt || '').trim() || 'abstract sculpture'
  const usedSeed = seed ?? hashString(cleanPrompt)
  const rng = makeRng(usedSeed)
  const recipeName = pickRecipe(cleanPrompt)
  const recipe = RECIPES[recipeName] || RECIPES.abstract
  const isPrimitive = PRIMITIVE_RECIPES.has(recipeName)

  let parts = recipe(rng)

  // Light, deterministic stylistic variation driven by the seed so re-rolls
  // feel different without breaking the recognizable shape. Primitives stay
  // exact (no random scaling) so "a sphere" is always a clean sphere.
  const globalScale = isPrimitive ? 1 : 0.92 + rng() * 0.18
  const geometry = combine(parts)
  geometry.scale(globalScale, globalScale, globalScale)

  // Center on origin and drop onto the build plate (y = 0).
  // NOTE: do NOT recompute vertex normals here — translate/uniform-scale don't
  // change normal directions, and combine() already preserved each shape's
  // correct (smooth vs flat) normals. Recomputing would flatten everything.
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox
  const cx = (bb.min.x + bb.max.x) / 2
  const cz = (bb.min.z + bb.max.z) / 2
  geometry.translate(-cx, -bb.min.y, -cz)
  geometry.computeBoundingBox()

  return { geometry, recipe: recipeName, seed: usedSeed, quality }
}

export const SUGGESTIONS = [
  'a dog',
  'a cat',
  'a dragon',
  'a dinosaur',
  'an elephant',
  'a duck',
  'a rabbit',
  'a bird',
  'a fish',
  'a horse',
  'a snake',
  'a person',
  'an airplane',
  'a boat',
  'a flower',
  'a mushroom',
  'a star',
  'a rocket ship',
  'a sports car',
  'a friendly robot',
]
