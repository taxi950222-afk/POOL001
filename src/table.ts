import * as THREE from 'three'
import type { TableMaterials } from './materials.ts'
import {
  BED,
  HALF_L,
  HALF_W,
  PLAY_L,
  PLAY_W,
  RAIL,
  SLATE_T,
  diamondMarks,
  tableHardware,
} from './spec.ts'

interface P2 {
  u: number
  v: number
}

const cushionProfile: P2[] = [
  { u: 0.03, v: 0.001 },
  { u: 0.022, v: 0.008 },
  { u: 0.014, v: 0.018 },
  { u: 0.007, v: 0.028 },
  { u: 0.002, v: 0.034 },
  { u: 0, v: 0.0363 },
  { u: 0.0025, v: 0.04 },
  { u: 0.009, v: 0.047 },
  { u: 0.017, v: 0.052 },
  { u: 0.025, v: 0.056 },
]

const woodProfile: P2[] = [
  { u: 0.02, v: 0.049 },
  { u: 0.032, v: 0.06 },
  { u: 0.048, v: 0.0645 },
  { u: 0.15, v: 0.0655 },
  { u: 0.166, v: 0.06 },
  { u: 0.174, v: 0.044 },
  { u: 0.18, v: 0.018 },
  { u: 0.18, v: -0.006 },
]

function sweep(profile: P2[], ax: number, az: number, bx: number, bz: number, ox: number, oz: number, a0: number, a1: number) {
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz) || 1
  const tx = dx / len
  const tz = dz / len
  const steps = Math.max(2, Math.ceil(len / 0.028))
  const jaw = 0.05
  const n = profile.length
  const positions: number[] = []
  const uvs: number[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const distS = t * len
    const distE = (1 - t) * len
    let shear = 0
    if (distS < jaw) shear += Math.tan(a0) * (1 - distS / jaw)
    if (distE < jaw) shear -= Math.tan(a1) * (1 - distE / jaw)
    const x = ax + tx * distS
    const z = az + tz * distS
    for (const p of profile) {
      const along = p.u * shear
      positions.push(x + ox * p.u + tx * along, BED + p.v, z + oz * p.u + tz * along)
      uvs.push(distS * 3, p.v * 8 + p.u * 4)
    }
  }
  const index: number[] = []
  for (let i = 0; i < steps; i++) {
    for (let p = 0; p < n - 1; p++) {
      const a = i * n + p
      const b = a + 1
      const c = a + n
      const d = c + 1
      index.push(a, c, b, b, c, d)
    }
  }
  const nose = profile.findIndex((p) => p.u === 0)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(index)
  geo.computeVertexNormals()
  if (nose >= 0) {
    const mid = Math.floor(steps / 2) * n + nose
    const nm = geo.getAttribute('normal')
    const dot = (nm.getX(mid) || 0) * ox + (nm.getZ(mid) || 0) * oz
    if (dot > 0) {
      for (let i = 0; i < index.length; i += 3) {
        const tmp = index[i + 1] ?? 0
        index[i + 1] = index[i + 2] ?? 0
        index[i + 2] = tmp
      }
      geo.setIndex(index)
      geo.computeVertexNormals()
    }
  }
  geo.computeVertexNormals()
  return geo
}

function addSweep(
  group: THREE.Group,
  profile: P2[],
  mat: THREE.Material,
  angle: (corner: boolean) => number,
) {
  for (const s of tableHardware().segs) {
    const geo = sweep(
      profile,
      s.ax,
      s.az,
      s.bx,
      s.bz,
      s.ox,
      s.oz,
      angle(s.cornerStart),
      angle(s.cornerEnd),
    )
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
}

function sackGeometry(rx: number, rz: number) {
  const rings = [
    { y: 0, sx: 1, sz: 1, ox: 0 },
    { y: -0.025, sx: 0.9, sz: 0.88, ox: 0.012 },
    { y: -0.07, sx: 0.78, sz: 0.74, ox: 0.02 },
    { y: -0.12, sx: 1.02, sz: 0.9, ox: 0.04 },
    { y: -0.17, sx: 0.72, sz: 0.62, ox: 0.03 },
    { y: -0.205, sx: 0.16, sz: 0.12, ox: 0.01 },
  ]
  const seg = 14
  const positions: number[] = []
  const index: number[] = []
  for (const ring of rings) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const wobble = 1 + 0.03 * Math.sin(i * 3)
      positions.push(
        Math.cos(a) * rx * ring.sx * wobble,
        ring.y,
        Math.sin(a) * rz * ring.sz * wobble + ring.ox,
      )
    }
  }
  const bottom = positions.length / 3
  positions.push(0, -0.22, 0.01)
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * seg + i
      const b = r * seg + ((i + 1) % seg)
      const c = a + seg
      const d = b + seg
      index.push(a, c, b, b, c, d)
    }
  }
  const last = (rings.length - 1) * seg
  for (let i = 0; i < seg; i++) {
    index.push(last + i, bottom, last + ((i + 1) % seg))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
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

export function buildTable(mats: TableMaterials) {
  const root = new THREE.Group()
  const slateL = PLAY_L + 0.068
  const slateW = PLAY_W + 0.068
  const gap = 0.0007
  const piece = (slateL - gap * 2) / 3
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(piece, SLATE_T, slateW), mats.slate)
    mesh.position.set(-slateL / 2 + piece / 2 + i * (piece + gap), BED - 0.0012 - SLATE_T / 2, 0)
    mesh.receiveShadow = true
    root.add(mesh)
  }
  const felt = new THREE.Mesh(new THREE.BoxGeometry(slateL, 0.0012, slateW), mats.cloth)
  felt.position.y = BED - 0.0006
  felt.receiveShadow = true
  root.add(felt)

  const seamMat = new THREE.MeshBasicMaterial({ color: '#06140c', transparent: true, opacity: 0.28 })
  for (const x of [-slateL / 6, slateL / 6]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.0004, PLAY_W), seamMat)
    seam.position.set(x, BED + 0.0003, 0)
    root.add(seam)
  }
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(0.004, 20),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.14 }),
  )
  spot.rotation.x = -Math.PI / 2
  spot.position.set(HALF_L - PLAY_L / 4, BED + 0.0008, 0)
  root.add(spot)

  addSweep(root, cushionProfile, mats.cloth, (corner) => (corner ? 0.72 : 0.46))
  addSweep(root, woodProfile, mats.oak, (corner) => (corner ? 0.62 : 0.4))

  const hw = tableHardware()
  for (const p of hw.pockets) {
    const leather = new THREE.Mesh(
      sackGeometry(p.corner ? 0.055 : 0.062, p.corner ? 0.05 : 0.048),
      mats.leather,
    )
    leather.position.set(p.x, BED - 0.012, p.z)
    leather.rotation.y = Math.atan2(p.ox, p.oz)
    leather.castShadow = true
    leather.receiveShadow = true
    root.add(leather)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(p.corner ? 0.042 : 0.046, 0.0042, 8, 22), mats.metal)
    rim.rotation.x = Math.PI / 2
    rim.position.set(p.x, BED + 0.008, p.z)
    rim.castShadow = true
    root.add(rim)
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(p.corner ? 0.034 : 0.038, 18),
      new THREE.MeshBasicMaterial({ color: '#12110f' }),
    )
    hole.rotation.x = -Math.PI / 2
    hole.position.set(p.x, BED - 0.02, p.z)
    root.add(hole)
  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), mats.oak)
  const bridgeN = bridge.clone()
  bridgeN.position.set(0, BED + 0.03, HALF_W + RAIL - 0.025)
  const bridgeS = bridge.clone()
  bridgeS.position.set(0, BED + 0.03, -(HALF_W + RAIL - 0.025))
  root.add(bridgeN, bridgeS)

  const apronY = 0.62
  const apronH = 0.25
  const apronMat = mats.oak
  const recess = mats.oak.clone()
  recess.color = new THREE.Color('#c9b48e')
  const segments = [
    { x: -0.72, z: HALF_W + RAIL - 0.012, w: 1.02, d: 0.02, rot: 0 },
    { x: 0.72, z: HALF_W + RAIL - 0.012, w: 1.02, d: 0.02, rot: 0 },
    { x: -0.72, z: -(HALF_W + RAIL - 0.012), w: 1.02, d: 0.02, rot: 0 },
    { x: 0.72, z: -(HALF_W + RAIL - 0.012), w: 1.02, d: 0.02, rot: 0 },
    { x: HALF_L + RAIL - 0.012, z: 0, w: 0.02, d: 0.92, rot: 0 },
    { x: -(HALF_L + RAIL - 0.012), z: 0, w: 0.02, d: 0.92, rot: 0 },
  ]
  for (const s of segments) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(s.w, apronH, s.d), apronMat)
    panel.position.set(s.x, apronY, s.z)
    panel.castShadow = true
    panel.receiveShadow = true
    root.add(panel)
    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.08, s.w - 0.08), apronH - 0.08, Math.max(0.01, s.d - 0.008)),
      recess,
    )
    const nudge = s.w > s.d ? Math.sign(s.z) * 0.004 : Math.sign(s.x) * 0.004
    if (s.w > s.d) inset.position.set(s.x, apronY, s.z + nudge)
    else inset.position.set(s.x + nudge, apronY, s.z)
    root.add(inset)
  }

  const legGeo = new THREE.CylinderGeometry(0.1 / Math.SQRT2, 0.118 / Math.SQRT2, 0.7, 4)
  legGeo.rotateY(Math.PI / 4)
  legGeo.translate(0, 0.35, 0)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, mats.oak)
      leg.position.set(sx * 1.12, 0, sz * 0.5)
      leg.castShadow = true
      leg.receiveShadow = true
      root.add(leg)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.15), mats.oak)
      foot.position.set(sx * 1.12, 0.018, sz * 0.5)
      foot.castShadow = true
      root.add(foot)
    }
  }

  for (const mark of diamondMarks()) {
    const d = new THREE.Mesh(diamondGeometry(mark.alongX), mats.pearl)
    d.position.set(mark.x, BED + 0.0662, mark.z)
    root.add(d)
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mats.floor)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const lamp = buildLamp(mats)
  root.add(lamp.group)
  return { root, lights: lamp.lights }
}

function buildLamp(mats: TableMaterials) {
  const group = new THREE.Group()
  const shadeGeo = shadeGeometry()
  const xs = [-0.48, 0, 0.48]
  const y = BED + 0.9
  const lights: THREE.SpotLight[] = []
  for (const x of xs) {
    const outer = new THREE.Mesh(shadeGeo, mats.lampShade)
    outer.position.set(x, y, 0)
    outer.castShadow = false
    const inner = new THREE.Mesh(shadeGeo, mats.lampInside)
    inner.position.copy(outer.position)
    inner.scale.setScalar(0.92)
    group.add(outer, inner)
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#ffe1b0' }),
    )
    bulb.position.set(x, y + 0.05, 0)
    group.add(bulb)
    const spot = new THREE.SpotLight('#ffc48a', 46, 6, 0.72, 0.55, 1)
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
  return { group, lights }
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
