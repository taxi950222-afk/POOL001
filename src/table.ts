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

interface RailCuts {
  nose: number
  wood: number
  nWest: number
  nEast: number
  sWest: number
  sEast: number
  eSouth: number
  eNorth: number
  wSouth: number
  wNorth: number
}

function localToWorld(mount: PocketMount, x: number, y: number, z: number): [number, number, number] {
  const a = mountAxes(mount)
  return [mount.x + x * a.xx + z * a.zx, mount.y + y, mount.z + x * a.xz + z * a.zz]
}

function worldToLocal(mount: PocketMount, x: number, z: number): XZ {
  const a = mountAxes(mount)
  const dx = x - mount.x
  const dz = z - mount.z
  return { x: dx * a.xx + dz * a.xz, z: dx * a.zx + dz * a.zz }
}

function mountMatrix(mount: PocketMount) {
  const a = mountAxes(mount)
  return new THREE.Matrix4().set(a.xx, 0, a.zx, mount.x, 0, 1, 0, mount.y, a.xz, 0, a.zz, mount.z, 0, 0, 0, 1)
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

function offsetToward(p: XZ, aim: XZ, dist: number): XZ {
  const dx = aim.x - p.x
  const dz = aim.z - p.z
  const len = Math.hypot(dx, dz) || 1
  return { x: p.x + (dx / len) * dist, z: p.z + (dz / len) * dist }
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

function addLocalBox(
  group: THREE.Group,
  mat: THREE.Material,
  mount: PocketMount,
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
  mesh.applyMatrix4(mountMatrix(mount))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function bandFromLocal(
  group: THREE.Group,
  mat: THREE.Material,
  mount: PocketMount,
  pts: XZ[],
  aimOf: (p: XZ, i: number) => XZ,
  inset: number,
  thick: number,
  y0: number,
  y1: number,
) {
  const pos: number[] = []
  const corner = (p: XZ, i: number, y: number, dist: number) => {
    const q = dist === 0 ? p : offsetToward(p, aimOf(p, i), dist)
    return localToWorld(mount, q.x, y, q.z)
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (!a || !b) continue
    const o0 = corner(a, i, y0, inset)
    const o1 = corner(b, i + 1, y0, inset)
    const i0 = corner(a, i, y0, thick)
    const i1 = corner(b, i + 1, y0, thick)
    const O0 = corner(a, i, y1, inset)
    const O1 = corner(b, i + 1, y1, inset)
    const I0 = corner(a, i, y1, thick)
    const I1 = corner(b, i + 1, y1, thick)
    pushQuad(pos, o0, o1, O1, O0)
    pushQuad(pos, i1, i0, I0, I1)
    pushQuad(pos, O0, O1, I1, I0)
    pushQuad(pos, i0, i1, o1, o0)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

/**
 * One opening for every pocket. The curve, the 45° corner nose, and the side
 * mouth all come from that pocket's parameter row and its mount.
 * Wood starts rubberThickness behind the nose, so the seam is rubber to leather.
 */
function addPocketOpenings(root: THREE.Group, mats: TableMaterials): RailCuts {
  const leather = mats.leather.clone()
  leather.side = THREE.DoubleSide
  leather.transparent = false
  leather.opacity = 1
  leather.depthWrite = true
  const rubber = mats.cloth.clone()
  rubber.side = THREE.DoubleSide
  rubber.transparent = false
  rubber.opacity = 1
  rubber.depthWrite = true
  rubber.polygonOffset = true
  rubber.polygonOffsetFactor = 1
  rubber.polygonOffsetUnits = 1
  const wood = mats.oak.clone()
  wood.side = THREE.DoubleSide
  wood.transparent = false
  wood.opacity = 1
  wood.depthWrite = true

  const side = pocketParams('side')
  const nose = side.throatWidth / 2 + side.jawRadius
  const woodCut = side.throatWidth / 2 + side.rubberThickness
  const along: Record<RailId, number[]> = { n: [], s: [], e: [], w: [] }

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
    const rub = params.rubberThickness
    const throatHalf = params.throatWidth / 2
    for (const track of [tracks.left, tracks.right]) {
      const lip = track[0]
      const c1 = track[1]
      const tee = track[track.length - 1]
      if (!lip || !c1 || !tee) continue
      const lipW = localToWorld(mount, lip.x, 0, lip.z)
      const rail = attachRail(lipW[0], lipW[2])
      const [ox, oz] = railOutward(rail)
      const awayX = Math.sign(lipW[0] - mount.x) || 1
      const awayZ = Math.sign(lipW[2] - mount.z) || 1
      const step = mount.kind === 'corner' ? 0.036 : 0.012
      const extW: [number, number] =
        rail === 'n' || rail === 's'
          ? [lipW[0] + awayX * step, rail === 'n' ? HALF_W : -HALF_W]
          : [rail === 'e' ? HALF_L : -HALF_L, lipW[2] + awayZ * step]
      along[rail].push(rail === 'n' || rail === 's' ? extW[0] : extW[1])

      const sign = Math.sign(tee.x || lip.x) || 1
      const c0 = { x: sign * (throatHalf + params.jawRadius), z: tee.z }
      const outward = worldToLocal(mount, mount.x + ox, mount.z + oz)
      const aim = (p: XZ, i: number) => (i === 0 ? { x: p.x + outward.x, z: p.z + outward.z } : c0)
      const nosePts = [worldToLocal(mount, extW[0], extW[1]), lip, c1]
      bandFromLocal(root, rubber, mount, nosePts, aim, 0, rub, 0.002, NOSE_H)
      bandFromLocal(root, rubber, mount, track.slice(1), () => c0, 0.0004, rub, 0.002, NOSE_H)
      const woodPts = [nosePts[0] ?? lip, ...track]
      bandFromLocal(root, wood, mount, woodPts, aim, rub, rub + 0.07, WOOD_BOTTOM, WOOD_TOP)
    }

    const zBack = params.depth + (mount.kind === 'side' ? params.drop * Math.tan((params.backTilt * Math.PI) / 180) : 0)
    const zT = mount.kind === 'side' ? params.jawRadius : (tracks.left[tracks.left.length - 1]?.z ?? params.zCapture)
    for (const sign of [-1, 1]) {
      addLocalBox(
        root,
        rubber,
        mount,
        sign * (throatHalf + 0.0004),
        sign * (throatHalf + rub),
        0.002,
        NOSE_H,
        zT,
        zBack,
      )
      addLocalBox(
        root,
        wood,
        mount,
        sign * (throatHalf + rub),
        sign * (throatHalf + rub + 0.07),
        WOOD_BOTTOM,
        WOOD_TOP,
        zT,
        zBack + 0.012,
      )
    }
  }

  return {
    nose,
    wood: woodCut,
    nWest: Math.min(...along.n),
    nEast: Math.max(...along.n),
    sWest: Math.min(...along.s),
    sEast: Math.max(...along.s),
    eSouth: Math.min(...along.e),
    eNorth: Math.max(...along.e),
    wSouth: Math.min(...along.w),
    wNorth: Math.max(...along.w),
  }
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

  const y0 = BED + WOOD_BOTTOM
  const y1 = BED + WOOD_TOP
  const outerX = HALF_L + RAIL
  const outerZ = HALF_W + RAIL
  const rub = pocketParams('side').rubberThickness
  const shell = 0.07
  const apronT = 0.04
  const apronH = 0.16
  const apronTop = y0 + 0.001
  const apronBottom = apronTop - apronH
  const cushY0 = BED + 0.002
  const cushY1 = BED + NOSE_H
  const cuts = addPocketOpenings(root, mats)
  const overlap = 0.004

  for (const sz of [1, -1] as const) {
    const west = (sz === 1 ? cuts.nWest : cuts.sWest) - overlap
    const east = (sz === 1 ? cuts.nEast : cuts.sEast) + overlap
    const zShell0 = sz * (outerZ - shell)
    const zShell1 = sz * outerZ
    const zInner0 = sz * (HALF_W + rub - 0.001)
    const zInner1 = sz * (outerZ - shell + 0.001)
    addBox(root, mats.oak, -outerX, -cuts.wood, y0, y1, zShell0, zShell1)
    addBox(root, mats.oak, cuts.wood, outerX, y0, y1, zShell0, zShell1)
    addBox(root, mats.oak, -outerX, west, y0, y1, zInner0, zInner1)
    addBox(root, mats.oak, west, -cuts.wood, y0, y1, zInner0, zInner1)
    addBox(root, mats.oak, cuts.wood, east, y0, y1, zInner0, zInner1)
    addBox(root, mats.oak, east, outerX, y0, y1, zInner0, zInner1)
    addBox(root, mats.cloth, west, -cuts.nose, cushY0, cushY1, sz * HALF_W, sz * (HALF_W + rub + 0.001))
    addBox(root, mats.cloth, cuts.nose, east, cushY0, cushY1, sz * HALF_W, sz * (HALF_W + rub + 0.001))
    addBox(root, mats.oak, west, -cuts.wood, BED + 0.034, y1, sz * (HALF_W + 0.002), zInner0)
    addBox(root, mats.oak, cuts.wood, east, BED + 0.034, y1, sz * (HALF_W + 0.002), zInner0)
    const zApron0 = sz * (outerZ - apronT)
    const zApron1 = sz * outerZ
    addBox(root, mats.oak, -outerX, -cuts.wood, apronBottom, apronTop, zApron0, zApron1)
    addBox(root, mats.oak, cuts.wood, outerX, apronBottom, apronTop, zApron0, zApron1)
  }

  for (const sx of [1, -1] as const) {
    const south = (sx === 1 ? cuts.eSouth : cuts.wSouth) - overlap
    const north = (sx === 1 ? cuts.eNorth : cuts.wNorth) + overlap
    const xShell0 = sx * (outerX - shell)
    const xShell1 = sx * outerX
    addBox(root, mats.oak, xShell0, xShell1, y0, y1, -(outerZ - shell - 0.004), outerZ - shell - 0.004)
    const xInner0 = sx * (HALF_L + rub - 0.001)
    const xInner1 = sx * (outerX - shell + 0.001)
    addBox(root, mats.oak, xInner0, xInner1, y0, y1, south, north)
    addBox(root, mats.cloth, sx * HALF_L, sx * (HALF_L + rub + 0.001), cushY0, cushY1, south, north)
    addBox(root, mats.oak, sx * (HALF_L + 0.002), xInner0, BED + 0.034, y1, south, north)
    const xApron0 = sx * (outerX - apronT)
    const xApron1 = sx * outerX
    addBox(root, mats.oak, xApron0, xApron1, apronBottom, apronTop, -(outerZ - apronT - 0.001), outerZ - apronT - 0.001)
  }

  const legTop = apronBottom
  const footH = 0.04
  const legGeo = new THREE.CylinderGeometry(0.045, 0.055, legTop - footH, 4)
  legGeo.rotateY(Math.PI / 4)
  legGeo.translate(0, (legTop - footH) / 2 + footH, 0)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, mats.oak)
      leg.position.set(sx * 1.16, 0, sz * 0.55)
      leg.castShadow = true
      leg.receiveShadow = true
      root.add(leg)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, footH, 0.13), mats.oak)
      foot.position.set(sx * 1.16, footH / 2, sz * 0.55)
      foot.castShadow = true
      root.add(foot)
    }
  }

  for (const mark of diamondMarks()) {
    const d = new THREE.Mesh(diamondGeometry(mark.alongX), mats.pearl)
    d.position.set(mark.x, BED + WOOD_TOP - 0.0011, mark.z)
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
