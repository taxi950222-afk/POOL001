import * as THREE from 'three'
import type { TableMaterials } from './materials.ts'
import { createPocketMesh } from './pocket/mesh.ts'
import { mountAxes, pocketMounts, pocketParams, type PocketMount, type PocketParams } from './pocket/params.ts'
import { createCornerProfile } from './pocket/profile.ts'
import {
  BED,
  CORNER_INSET,
  HALF_L,
  HALF_W,
  NOSE_H,
  PLAY_L,
  PLAY_W,
  RAIL,
  SLATE_T,
  diamondMarks,
} from './spec.ts'

const WOOD_BOTTOM = -0.028
const WOOD_TOP = 0.064
/** Inner half of the 0.18 m rail, stopped just before the diamond sights at 0.0889 m. */
const CLOTH_REACH = 0.084
const ROUND_R = WOOD_TOP - NOSE_H
/** Continuous outer oak starts here, past the side-pocket back wall. */
const OAK_SPLIT = 0.15
const LIP_R = 0.013
const OUTER_R = 0.028
const V_CORNER = 0.085
const APRON_H = 0.16
const APRON_T = 0.048
const APRON_R = 0.018
const HOLE_HALF = 0.052

function addBox(
  group: THREE.Group,
  mat: THREE.Material,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
) {
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  const d = Math.abs(z1 - z0)
  if (w < 1e-6 || h < 1e-6 || d < 1e-6) return
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function shadeGeometry() {
  const topW = 0.26
  const topD = 0.16
  const botW = 0.4
  const botD = 0.26
  const h = 0.15
  const pts = [
    [-topW / 2, h, -topD / 2],
    [topW / 2, h, -topD / 2],
    [topW / 2, h, topD / 2],
    [-topW / 2, h, topD / 2],
    [-botW / 2, 0, -botD / 2],
    [botW / 2, 0, -botD / 2],
    [botW / 2, 0, botD / 2],
    [-botW / 2, 0, botD / 2],
  ]
  const faces = [
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
    [0, 1, 2, 3],
  ]
  const positions: number[] = []
  for (const f of faces) {
    const a = pts[f[0] ?? 0]
    const b = pts[f[1] ?? 0]
    const c = pts[f[2] ?? 0]
    const d = pts[f[3] ?? 0]
    if (!a || !b || !c || !d) continue
    positions.push(...a, ...b, ...c, ...a, ...c, ...d)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

function diamondGeometry(alongX: boolean) {
  const L = 0.008
  const W = 0.0042
  const h = 0.0011
  const shape = new THREE.Shape()
  if (alongX) {
    shape.moveTo(0, W)
    shape.lineTo(L, 0)
    shape.lineTo(0, -W)
    shape.lineTo(-L, 0)
  } else {
    shape.moveTo(W, 0)
    shape.lineTo(0, L)
    shape.lineTo(-W, 0)
    shape.lineTo(0, -L)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, h, 0)
  return geo
}

interface XZ {
  x: number
  z: number
}

function localToWorld(mount: PocketMount, x: number, y: number, z: number): [number, number, number] {
  const a = mountAxes(mount)
  return [mount.x + x * a.xx + z * a.zx, mount.y + y, mount.z + x * a.xz + z * a.zz]
}

/** Lip through the jawRadius fillet to point T. Corner and side stay different curves. */
function jawOpening(params: PocketParams, kind: PocketMount['kind']): { left: XZ[]; right: XZ[] } {
  if (kind === 'corner') {
    const pts = createCornerProfile(params)
    const far = pts.findIndex((p) => p.z === params.depth)
    return { left: pts.slice(0, far), right: pts.slice(far + 2).reverse() }
  }
  const mouthHalf = params.mouthWidth / 2
  const throatHalf = params.throatWidth / 2
  const r = params.jawRadius
  const c0x = throatHalf + r
  const zT = r
  const steps = 18
  const left: XZ[] = [
    { x: -mouthHalf, z: 0 },
    { x: -c0x, z: 0 },
  ]
  for (let i = 1; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2)
    left.push({ x: -c0x + r * Math.cos(a), z: zT + r * Math.sin(a) })
  }
  const right: XZ[] = [{ x: mouthHalf, z: 0 }, { x: c0x, z: 0 }]
  for (let i = steps - 1; i >= 0; i--) {
    const a = Math.PI + (i / steps) * (Math.PI / 2)
    right.push({ x: c0x + r * Math.cos(a), z: zT + r * Math.sin(a) })
  }
  return { left, right }
}

type RailId = 'n' | 's' | 'e' | 'w'

function attachRail(x: number, z: number): RailId {
  const dz = Math.abs(Math.abs(z) - HALF_W)
  const dx = Math.abs(Math.abs(x) - HALF_L)
  if (dz <= dx) return z >= 0 ? 'n' : 's'
  return x >= 0 ? 'e' : 'w'
}

function railOutward(rail: RailId): [number, number] {
  if (rail === 'n') return [0, 1]
  if (rail === 's') return [0, -1]
  if (rail === 'e') return [1, 0]
  return [-1, 0]
}

function pushQuad(pos: number[], a: number[], b: number[], c: number[], d: number[]) {
  pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2])
}

interface SectionPt {
  u: number
  y: number
}

interface PathPt {
  x: number
  z: number
  nx: number
  nz: number
}

function addMesh(group: THREE.Group, mat: THREE.Material, pos: number[]) {
  if (pos.length < 9) return
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function sweepSection(pos: number[], path: PathPt[], section: SectionPt[], capStart: boolean, capEnd: boolean) {
  if (path.length < 2 || section.length < 2) return
  const rings: number[][][] = []
  for (const p of path) {
    const ring: number[][] = []
    for (const s of section) ring.push([p.x + p.nx * s.u, BED + s.y, p.z + p.nz * s.u])
    rings.push(ring)
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i]
    const b = rings[i + 1]
    if (!a || !b) continue
    for (let j = 0; j < section.length - 1; j++) {
      const a0 = a[j]
      const a1 = a[j + 1]
      const b0 = b[j]
      const b1 = b[j + 1]
      if (!a0 || !a1 || !b0 || !b1) continue
      pushQuad(pos, a0, b0, b1, a1)
    }
  }
  const cap = (ring: number[][] | undefined, flip: boolean) => {
    if (!ring || ring.length < 3) return
    const c = [0, 0, 0]
    for (const p of ring) {
      c[0] += p[0] ?? 0
      c[1] += p[1] ?? 0
      c[2] += p[2] ?? 0
    }
    c[0] /= ring.length
    c[1] /= ring.length
    c[2] /= ring.length
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]
      const b = ring[i + 1]
      if (!a || !b) continue
      if (flip) pos.push(c[0], c[1], c[2], b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, a[0] ?? 0, a[1] ?? 0, a[2] ?? 0)
      else pos.push(c[0], c[1], c[2], a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, b[0] ?? 0, b[1] ?? 0, b[2] ?? 0)
    }
  }
  if (capStart) cap(rings[0], true)
  if (capEnd) cap(rings[rings.length - 1], false)
}

function noseSection(): SectionPt[] {
  const pts: SectionPt[] = []
  const yBed = 0.0018
  const s = Math.max(-1, Math.min(1, (yBed - LIP_R) / LIP_R))
  const thetaBed = Math.PI - Math.asin(s)
  const fillet = 5
  for (let i = 0; i <= fillet; i++) {
    const theta = thetaBed + (Math.PI - thetaBed) * (i / fillet)
    pts.push({ u: LIP_R + LIP_R * Math.cos(theta), y: LIP_R + LIP_R * Math.sin(theta) })
  }
  const vertical = 3
  for (let i = 1; i <= vertical; i++) {
    pts.push({ u: 0, y: LIP_R + (NOSE_H - LIP_R) * (i / vertical) })
  }
  const arc = 8
  for (let i = 1; i <= arc; i++) {
    const theta = Math.PI - (i / arc) * (Math.PI / 2)
    pts.push({ u: ROUND_R + ROUND_R * Math.cos(theta), y: NOSE_H + ROUND_R * Math.sin(theta) })
  }
  const thick = 0.004
  const ri = ROUND_R - thick
  pts.push({ u: ROUND_R, y: WOOD_TOP - thick })
  for (let i = arc - 1; i >= 1; i--) {
    const theta = Math.PI - (i / arc) * (Math.PI / 2)
    pts.push({ u: ROUND_R + ri * Math.cos(theta), y: NOSE_H + ri * Math.sin(theta) })
  }
  pts.push({ u: thick, y: NOSE_H })
  pts.push({ u: thick, y: LIP_R })
  const first = pts[0]
  if (first) pts.push({ u: first.u, y: first.y })
  return pts
}

function cabinetSection(): SectionPt[] {
  const inner = -(RAIL - OAK_SPLIT)
  const bottom = WOOD_BOTTOM - APRON_H
  const pts: SectionPt[] = [
    { u: inner, y: WOOD_BOTTOM },
    { u: inner, y: WOOD_TOP },
    { u: -OUTER_R, y: WOOD_TOP },
  ]
  const n = 8
  for (let i = 1; i <= n; i++) {
    const phi = Math.PI / 2 - (i / n) * (Math.PI / 2)
    pts.push({
      u: -OUTER_R + OUTER_R * Math.cos(phi),
      y: WOOD_TOP - OUTER_R + OUTER_R * Math.sin(phi),
    })
  }
  pts.push({ u: 0, y: bottom + APRON_R })
  for (let i = 1; i <= n; i++) {
    const phi = -(i / n) * (Math.PI / 2)
    pts.push({
      u: -APRON_R + APRON_R * Math.cos(phi),
      y: bottom + APRON_R + APRON_R * Math.sin(phi),
    })
  }
  pts.push({ u: -APRON_T, y: bottom })
  pts.push({ u: -APRON_T, y: WOOD_BOTTOM })
  pts.push({ u: inner, y: WOOD_BOTTOM })
  return pts
}

function roundedRectPath(hx: number, hz: number, r: number): PathPt[] {
  const path: PathPt[] = []
  const n = 12
  const arc = (cx: number, cz: number, a0: number, a1: number) => {
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      path.push({ x: cx + r * Math.cos(a), z: cz + r * Math.sin(a), nx: Math.cos(a), nz: Math.sin(a) })
    }
  }
  path.push({ x: hx, z: -(hz - r), nx: 1, nz: 0 })
  path.push({ x: hx, z: hz - r, nx: 1, nz: 0 })
  arc(hx - r, hz - r, 0, Math.PI / 2)
  path.push({ x: -(hx - r), z: hz, nx: 0, nz: 1 })
  arc(-(hx - r), hz - r, Math.PI / 2, Math.PI)
  path.push({ x: -hx, z: -(hz - r), nx: -1, nz: 0 })
  arc(-(hx - r), -(hz - r), Math.PI, Math.PI * 1.5)
  path.push({ x: hx - r, z: -hz, nx: 0, nz: -1 })
  arc(hx - r, -(hz - r), Math.PI * 1.5, Math.PI * 2)
  return path
}

function extrudeFootprint(group: THREE.Group, mat: THREE.Material, pts: [number, number][], y0: number, y1: number) {
  if (pts.length < 3 || y1 - y0 < 1e-5) return
  const shape = new THREE.Shape()
  const first = pts[0]
  if (!first) return
  shape.moveTo(first[0], first[1])
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    if (p) shape.lineTo(p[0], p[1])
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false })
  geo.rotateX(Math.PI / 2)
  geo.translate(0, y1, 0)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function clipRect(
  pts: [number, number][],
  x0: number,
  x1: number,
  z0: number,
  z1: number,
): [number, number][] {
  const clipEdge = (
    input: [number, number][],
    inside: (p: [number, number]) => boolean,
    at: (a: [number, number], b: [number, number]) => [number, number],
  ) => {
    if (input.length === 0) return input
    const out: [number, number][] = []
    for (let i = 0; i < input.length; i++) {
      const s = input[i]
      const e = input[(i + 1) % input.length]
      if (!s || !e) continue
      const si = inside(s)
      const ei = inside(e)
      if (si && ei) out.push(e)
      else if (si && !ei) out.push(at(s, e))
      else if (!si && ei) {
        out.push(at(s, e))
        out.push(e)
      }
    }
    return out
  }
  const hitX = (x: number) => (a: [number, number], b: [number, number]): [number, number] => {
    const t = (x - a[0]) / (b[0] - a[0] || 1e-9)
    return [x, a[1] + (b[1] - a[1]) * t]
  }
  const hitZ = (z: number) => (a: [number, number], b: [number, number]): [number, number] => {
    const t = (z - a[1]) / (b[1] - a[1] || 1e-9)
    return [a[0] + (b[0] - a[0]) * t, z]
  }
  let p = pts
  p = clipEdge(p, (q) => q[0] >= x0, hitX(x0))
  p = clipEdge(p, (q) => q[0] <= x1, hitX(x1))
  p = clipEdge(p, (q) => q[1] >= z0, hitZ(z0))
  p = clipEdge(p, (q) => q[1] <= z1, hitZ(z1))
  return p
}

function cornerArc(mount: PocketMount): [number, number][] {
  const tracks = jawOpening(pocketParams('corner'), 'corner')
  const a = tracks.left[tracks.left.length - 1]
  const b = tracks.right[tracks.right.length - 1]
  if (!a || !b) return []
  const zApex = 0.125
  const cz = 2 * zApex - 0.5 * (a.z + b.z)
  const pts: [number, number][] = []
  const steps = 14
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    const x = u * u * a.x + t * t * b.x
    const z = u * u * a.z + 2 * u * t * cz + t * t * b.z
    const w = localToWorld(mount, x, 0, z)
    pts.push([w[0], w[2]])
  }
  return pts
}

function cornerWood(mount: PocketMount): [number, number][] {
  const arc = cornerArc(mount)
  const a0 = arc[0]
  const a1 = arc[arc.length - 1]
  if (!a0 || !a1) return []
  const sx = Math.sign(mount.x) || 1
  const sz = Math.sign(mount.z) || 1
  const xOut = sx * (HALF_L + OAK_SPLIT - 0.02)
  const zOut = sz * (HALF_W + OAK_SPLIT - 0.02)
  return [...arc, [xOut, a1[1]], [xOut, zOut], [a0[0], zOut]]
}

function sideOak(sign: 1 | -1): [number, number][] {
  const mouth = pocketParams('side').mouthWidth / 2
  const zIn = sign * (HALF_W + CLOTH_REACH - 0.001)
  const zBend = sign * (HALF_W + 0.132)
  const zBack = sign * (HALF_W + 0.148)
  const zFar = sign * (HALF_W + OAK_SPLIT - 0.002)
  const r = 0.016
  const half = HOLE_HALF
  const pts: [number, number][] = [
    [-mouth, zIn],
    [-mouth, zFar],
    [mouth, zFar],
    [mouth, zIn],
    [half, zIn],
    [half, zBend],
  ]
  const steps = 6
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2)
    pts.push([half - r + r * Math.cos(a), zBend + sign * r * Math.sin(a)])
  }
  pts.push([-(half - r), zBack])
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2)
    pts.push([-(half - r) - r * Math.sin(a), zBend + sign * r * Math.cos(a)])
  }
  pts.push([-half, zIn])
  return pts
}

function jawPath(mount: PocketMount, track: XZ[]): { path: PathPt[]; rail: RailId; cut: number } | null {
  const lip = track[0]
  const tee = track[track.length - 1]
  if (!lip || !tee) return null
  const lipW = localToWorld(mount, lip.x, 0, lip.z)
  const rail = attachRail(lipW[0], lipW[2])
  const [nx, nz] = railOutward(rail)
  const join =
    rail === 'n' || rail === 's'
      ? { x: lipW[0], z: rail === 'n' ? HALF_W : -HALF_W }
      : { x: rail === 'e' ? HALF_L : -HALF_L, z: lipW[2] }
  const params = pocketParams(mount.kind)
  const sign = Math.sign(tee.x || lip.x) || 1
  const c0 = { x: sign * (params.throatWidth / 2 + params.jawRadius), z: tee.z }
  const path: PathPt[] = []
  if (Math.hypot(join.x - lipW[0], join.z - lipW[2]) > 1e-4) path.push({ x: join.x, z: join.z, nx, nz })
  for (let i = 0; i < track.length; i++) {
    const p = track[i]
    if (!p) continue
    const w = localToWorld(mount, p.x, 0, p.z)
    let px = nx
    let pz = nz
    if (i > 0) {
      const c0w = localToWorld(mount, c0.x, 0, c0.z)
      const dx = c0w[0] - w[0]
      const dz = c0w[2] - w[2]
      const len = Math.hypot(dx, dz)
      if (len > 1e-6) {
        px = dx / len
        pz = dz / len
      }
    }
    path.push({ x: w[0], z: w[2], nx: px, nz: pz })
  }
  return { path, rail, cut: rail === 'n' || rail === 's' ? join.x : join.z }
}

function addSweep(group: THREE.Group, mat: THREE.Material, path: PathPt[], section: SectionPt[], capStart: boolean, capEnd: boolean) {
  const pos: number[] = []
  sweepSection(pos, path, section, capStart, capEnd)
  addMesh(group, mat, pos)
}

/** Rail-top plate over the bare wood at a side mouth. The notch is the open hole. */
function sideCapPlate(sign: 1 | -1): [number, number][] {
  const xWide = 0.15
  const mouth = 0.066
  const zIn = sign * (HALF_W + 0.032)
  const zOut = sign * (HALF_W + RAIL - 0.006)
  const zBack = sign * (HALF_W + 0.158)
  const pts: [number, number][] = [
    [-xWide, zIn],
    [-xWide, zOut],
    [xWide, zOut],
    [xWide, zIn],
    [mouth, zIn],
    [mouth, zBack],
    [-mouth, zBack],
    [-mouth, zIn],
  ]
  if (sign < 0) pts.reverse()
  return pts
}

/** Rail-top plate from the corner mouth out over the bare wood. The arc side stays open. */
function cornerCapPlate(mount: PocketMount): [number, number][] {
  const gap = 0.014
  const arc = cornerArc(mount).map(([x, z]) => {
    const dx = x - mount.x
    const dz = z - mount.z
    const len = Math.hypot(dx, dz) || 1
    return [x + (dx / len) * gap, z + (dz / len) * gap] as [number, number]
  })
  const a0 = arc[0]
  const a1 = arc[arc.length - 1]
  if (!a0 || !a1) return []
  const sx = Math.sign(mount.x) || 1
  const sz = Math.sign(mount.z) || 1
  const hx = HALF_L + RAIL
  const hz = HALF_W + RAIL
  const inset = 0.01
  const cx = sx * (hx - V_CORNER)
  const cz = sz * (hz - V_CORNER)
  const rad = V_CORNER - inset
  const xFlat = sx * (hx - inset)
  const zFlat = sz * (hz - inset)
  const ang0 = Math.atan2(0, sx)
  const ang1 = Math.atan2(sz, 0)
  let sweep = ang1 - ang0
  if (sweep > Math.PI) sweep -= Math.PI * 2
  if (sweep < -Math.PI) sweep += Math.PI * 2
  const outer: [number, number][] = []
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const a = ang0 + (sweep * i) / steps
    outer.push([cx + rad * Math.cos(a), cz + rad * Math.sin(a)])
  }
  return [...arc, [xFlat, a1[1]], ...outer, [a0[0], zFlat]]
}

function addPocketCaps(root: THREE.Group, mats: TableMaterials) {
  const metal = mats.metal.clone()
  metal.color.set('#d8dde3')
  metal.metalness = 0.6
  metal.roughness = 0.35
  metal.emissive.set('#c5ccd2')
  metal.emissiveIntensity = 0.28
  metal.side = THREE.DoubleSide
  metal.transparent = false
  metal.opacity = 1
  metal.depthWrite = true
  const y0 = BED + WOOD_TOP + 0.005
  const y1 = y0 + 0.0045
  for (const sign of [1, -1] as const) extrudeFootprint(root, metal, sideCapPlate(sign), y0, y1)
  for (const mount of pocketMounts()) {
    if (mount.kind !== 'corner') continue
    extrudeFootprint(root, metal, cornerCapPlate(mount), y0, y1)
  }
}

/** Rails, rounded cabinet, and the six pocket mouths. Physics is unchanged. */
function addCabinet(root: THREE.Group, mats: TableMaterials) {
  const leather = mats.leather.clone()
  leather.side = THREE.DoubleSide
  leather.transparent = false
  leather.opacity = 1
  leather.depthWrite = true
  const cloth = mats.cloth.clone()
  cloth.side = THREE.DoubleSide
  const oak = mats.oak.clone()
  oak.side = THREE.DoubleSide
  const clothTop = mats.cloth.clone()
  clothTop.side = THREE.DoubleSide
  const nose = noseSection()
  const cuts: Record<RailId, number[]> = { n: [], s: [], e: [], w: [] }

  for (const mount of pocketMounts()) {
    const params = pocketParams(mount.kind)
    const pocket = createPocketMesh(mount.kind, params)
    pocket.position.set(mount.x, mount.y, mount.z)
    pocket.rotation.y = mount.yaw
    pocket.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = leather
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
    root.add(pocket)
    const tracks = jawOpening(params, mount.kind)
    for (const track of [tracks.left, tracks.right]) {
      const jaw = jawPath(mount, track)
      if (!jaw) continue
      cuts[jaw.rail].push(jaw.cut)
      addSweep(root, cloth, jaw.path, nose, false, true)
    }
    if (mount.kind === 'corner') {
      const wood = cornerWood(mount)
      extrudeFootprint(root, oak, wood, BED + WOOD_BOTTOM, BED + WOOD_TOP)
      const sx = Math.sign(mount.x) || 1
      const sz = Math.sign(mount.z) || 1
      const bands = [
        {
          x0: sx > 0 ? -2 : sx * (HALF_L + CLOTH_REACH),
          x1: sx > 0 ? sx * (HALF_L + CLOTH_REACH) : 2,
          z0: sz * (HALF_W + ROUND_R - 0.002),
          z1: sz * (HALF_W + CLOTH_REACH),
        },
        {
          x0: sx * (HALF_L + ROUND_R - 0.002),
          x1: sx * (HALF_L + CLOTH_REACH),
          z0: sz > 0 ? -2 : sz * (HALF_W + CLOTH_REACH),
          z1: sz > 0 ? sz * (HALF_W + CLOTH_REACH) : 2,
        },
      ]
      for (const band of bands) {
        const loX = Math.min(band.x0, band.x1)
        const hiX = Math.max(band.x0, band.x1)
        const loZ = Math.min(band.z0, band.z1)
        const hiZ = Math.max(band.z0, band.z1)
        extrudeFootprint(root, clothTop, clipRect(wood, loX, hiX, loZ, hiZ), BED + WOOD_TOP - 0.004, BED + WOOD_TOP)
      }
    }
  }

  const outer: number[] = []
  sweepSection(outer, roundedRectPath(HALF_L + RAIL, HALF_W + RAIL, V_CORNER), cabinetSection(), false, false)
  addMesh(root, oak, outer)

  const spans = (rail: RailId): [number, number][] => {
    const v = [...cuts[rail]].sort((a, b) => a - b)
    const out: [number, number][] = []
    for (let i = 0; i + 1 < v.length; i += 2) {
      const a = v[i]
      const b = v[i + 1]
      if (a !== undefined && b !== undefined) out.push([a, b])
    }
    return out
  }

  const yNose = BED + NOSE_H
  const yUnder = BED + WOOD_TOP - 0.006
  const yTop = BED + WOOD_TOP + 0.001
  const yBot = BED + WOOD_BOTTOM

  for (const rail of ['n', 's', 'e', 'w'] as const) {
    const [nx, nz] = railOutward(rail)
    for (const [a, b] of spans(rail)) {
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      if (hi - lo < 0.02) continue
      if (rail === 'n' || rail === 's') {
        const z = rail === 'n' ? HALF_W : -HALF_W
        addSweep(root, cloth, [
          { x: lo, z, nx, nz },
          { x: hi, z, nx, nz },
        ], nose, true, true)
        const zRound = z + nz * (ROUND_R - 0.001)
        const zCloth = z + nz * CLOTH_REACH
        const zOak = z + nz * (OAK_SPLIT - 0.004)
        const zLip = z + nz * (LIP_R + 0.001)
        addBox(root, clothTop, lo, hi, yUnder, yTop, Math.min(zRound, zCloth), Math.max(zRound, zCloth))
        addBox(root, mats.oak, lo, hi, yBot, yUnder, Math.min(zRound, zCloth), Math.max(zRound, zCloth))
        addBox(root, mats.oak, lo, hi, yBot, yTop, Math.min(zCloth, zOak), Math.max(zCloth, zOak))
        addBox(root, mats.oak, lo, hi, yBot, yNose, Math.min(zLip, z + nz * ROUND_R), Math.max(zLip, z + nz * ROUND_R))
      } else {
        const x = rail === 'e' ? HALF_L : -HALF_L
        addSweep(root, cloth, [
          { x, z: lo, nx, nz },
          { x, z: hi, nx, nz },
        ], nose, true, true)
        const xRound = x + nx * (ROUND_R - 0.001)
        const xCloth = x + nx * CLOTH_REACH
        const xOak = x + nx * (OAK_SPLIT - 0.004)
        const xLip = x + nx * (LIP_R + 0.001)
        addBox(root, clothTop, Math.min(xRound, xCloth), Math.max(xRound, xCloth), yUnder, yTop, lo, hi)
        addBox(root, mats.oak, Math.min(xRound, xCloth), Math.max(xRound, xCloth), yBot, yUnder, lo, hi)
        addBox(root, mats.oak, Math.min(xCloth, xOak), Math.max(xCloth, xOak), yBot, yTop, lo, hi)
        addBox(root, mats.oak, Math.min(xLip, x + nx * ROUND_R), Math.max(xLip, x + nx * ROUND_R), yBot, yNose, lo, hi)
      }
    }
  }

  const mouth = pocketParams('side').mouthWidth / 2
  for (const sign of [1, -1] as const) {
    extrudeFootprint(root, oak, sideOak(sign), yBot, yTop)
    const zRound = sign * (HALF_W + ROUND_R - 0.001)
    const zCloth = sign * (HALF_W + CLOTH_REACH)
    for (const side of [-1, 1] as const) {
      const x0 = side * HOLE_HALF
      const x1 = side * mouth
      addBox(root, clothTop, Math.min(x0, x1), Math.max(x0, x1), yUnder, yTop, Math.min(zRound, zCloth), Math.max(zRound, zCloth))
      addBox(root, mats.oak, Math.min(x0, x1), Math.max(x0, x1), yBot, yUnder, Math.min(zRound, zCloth), Math.max(zRound, zCloth))
    }
  }

  addPocketCaps(root, mats)
}

function bedShape() {
  const shape = new THREE.Shape()
  const xl = HALF_L - CORNER_INSET
  const xh = HALF_L
  const zw = HALF_W
  const zc = HALF_W - CORNER_INSET
  shape.moveTo(-xl, -zw)
  shape.lineTo(xl, -zw)
  shape.lineTo(xh, -zc)
  shape.lineTo(xh, zc)
  shape.lineTo(xl, zw)
  shape.lineTo(-xl, zw)
  shape.lineTo(-xh, zc)
  shape.lineTo(-xh, -zc)
  shape.closePath()
  return shape
}

export function buildTable(mats: TableMaterials) {
  const root = new THREE.Group()
  const clothT = 0.0015
  const felt = new THREE.Mesh(new THREE.ExtrudeGeometry(bedShape(), { depth: clothT, bevelEnabled: false }), mats.cloth)
  felt.rotation.x = -Math.PI / 2
  felt.position.y = BED - clothT
  felt.receiveShadow = true
  root.add(felt)

  const slateGap = 0.0008
  const slateL = PLAY_L - 0.04
  const slateW = PLAY_W - 0.04
  const piece = (slateL - slateGap * 2) / 3
  const slateTop = BED - clothT - 0.0025
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(piece, SLATE_T, slateW), mats.slate)
    mesh.position.set(-slateL / 2 + piece / 2 + i * (piece + slateGap), slateTop - SLATE_T / 2, 0)
    mesh.receiveShadow = true
    root.add(mesh)
  }

  const seamMat = new THREE.MeshBasicMaterial({ color: '#06140c', transparent: true, opacity: 0.28 })
  for (const x of [-slateL / 6, slateL / 6]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0002, PLAY_W - 0.12), seamMat)
    seam.position.set(x, BED + 0.00012, 0)
    root.add(seam)
  }
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(0.004, 20),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.14 }),
  )
  spot.rotation.x = -Math.PI / 2
  spot.position.set(HALF_L - PLAY_L / 4, BED + 0.0002, 0)
  root.add(spot)

  addCabinet(root, mats)

  const apronBottom = BED + WOOD_BOTTOM - APRON_H
  const footH = 0.05
  const legFlatTop = 0.125
  const legFlatBot = 0.14
  const legGeo = new THREE.CylinderGeometry(legFlatTop / Math.SQRT2, legFlatBot / Math.SQRT2, apronBottom - footH, 4)
  legGeo.rotateY(Math.PI / 4)
  legGeo.translate(0, (apronBottom - footH) / 2 + footH, 0)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, mats.oak)
      leg.position.set(sx * 1.16, 0, sz * 0.55)
      leg.castShadow = true
      leg.receiveShadow = true
      root.add(leg)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, footH, 0.2), mats.oak)
      foot.position.set(sx * 1.16, footH / 2, sz * 0.55)
      foot.castShadow = true
      root.add(foot)
    }
  }

  for (const mark of diamondMarks()) {
    const d = new THREE.Mesh(diamondGeometry(mark.alongX), mats.pearl)
    d.position.set(mark.x, BED + WOOD_TOP - 0.0008, mark.z)
    root.add(d)
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mats.floor)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const lamp = buildLamp(mats)
  root.add(lamp.group)
  return { root, lights: lamp.lights, bulbs: lamp.bulbs }
}

function buildLamp(mats: TableMaterials) {
  const group = new THREE.Group()
  const shadeGeo = shadeGeometry()
  const xs = [-0.48, 0, 0.48]
  const y = BED + 0.72
  const lights: THREE.SpotLight[] = []
  const bulbs: THREE.MeshStandardMaterial[] = []
  for (const x of xs) {
    const outer = new THREE.Mesh(shadeGeo, mats.lampShade)
    outer.position.set(x, y, 0)
    outer.castShadow = false
    const inner = new THREE.Mesh(shadeGeo, mats.lampInside)
    inner.position.copy(outer.position)
    inner.scale.setScalar(0.92)
    group.add(outer, inner)
    const bulbMat = new THREE.MeshStandardMaterial({
      color: '#ffd7a4',
      emissive: '#ffb15a',
      emissiveIntensity: 0.1125,
      roughness: 0.4,
    })
    bulbs.push(bulbMat)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), bulbMat)
    bulb.position.set(x, y + 0.05, 0)
    group.add(bulb)
    const spot = new THREE.SpotLight('#ffc48a', 1.75, 5.5, 0.68, 0.62, 1)
    spot.position.set(x, y + 0.02, 0)
    spot.target.position.set(x * 0.3, BED, 0)
    spot.castShadow = true
    spot.shadow.mapSize.set(1024, 1024)
    spot.shadow.bias = -0.0004
    spot.shadow.normalBias = 0.03
    spot.shadow.camera.near = 0.2
    spot.shadow.camera.far = 4.5
    group.add(spot, spot.target)
    lights.push(spot)
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.025, 0.025), mats.brass)
  bar.position.set(0, y + 0.17, 0)
  group.add(bar)
  for (const x of [-0.42, 0.42]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.72, 6), mats.brass)
    chain.position.set(x, y + 0.17 + 0.36, 0)
    group.add(chain)
  }
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), mats.brass)
  rose.position.set(0, y + 0.17 + 0.72, 0)
  group.add(rose)
  return { group, lights, bulbs }
}

export function buildCue() {
  const group = new THREE.Group()
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.011, 1.15, 10),
    new THREE.MeshStandardMaterial({ color: '#d7b07a', roughness: 0.45 }),
  )
  shaft.rotation.z = Math.PI / 2
  shaft.position.x = -0.62
  const butt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.013, 0.28, 10),
    new THREE.MeshStandardMaterial({ color: '#5a3018', roughness: 0.5 }),
  )
  butt.rotation.z = Math.PI / 2
  butt.position.x = -1.28
  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.006, 0.025, 8),
    new THREE.MeshStandardMaterial({ color: '#2f6df0', roughness: 0.4 }),
  )
  tip.rotation.z = Math.PI / 2
  tip.position.x = -0.03
  group.add(shaft, butt, tip)
  group.rotation.order = 'YXZ'
  return group
}
