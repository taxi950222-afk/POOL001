import * as THREE from 'three'
import type { TableMaterials } from './materials.ts'
import {
  BED,
  CORNER_INSET,
  HALF_L,
  HALF_W,
  PLAY_L,
  PLAY_W,
  RAIL,
  SIDE_HALF,
  SLATE_T,
  diamondMarks,
  tableHardware,
} from './spec.ts'

interface P2 {
  u: number
  v: number
}

// u grows outward from the nose into the rail. The rubber stays in front of u=0.016.
// The wood groove starts at u=0.021 and the cap sits above the rubber.
const cushionProfile: P2[] = [
  { u: 0.014, v: 0.002 },
  { u: 0.008, v: 0.014 },
  { u: 0.003, v: 0.026 },
  { u: 0, v: 0.0363 },
  { u: 0.005, v: 0.041 },
  { u: 0.012, v: 0.045 },
]

const woodProfile: P2[] = [
  { u: 0.021, v: 0 },
  { u: 0.021, v: 0.049 },
  { u: 0.011, v: 0.053 },
  { u: 0.02, v: 0.061 },
  { u: 0.15, v: 0.064 },
  { u: 0.17, v: 0.056 },
  { u: 0.18, v: 0.02 },
  { u: 0.18, v: -0.028 },
]

const WOOD_BOTTOM = -0.028
const WOOD_TOP = 0.064

function triNormal(positions: number[], ia: number, ib: number, ic: number) {
  const ax = positions[ia * 3] ?? 0
  const ay = positions[ia * 3 + 1] ?? 0
  const az = positions[ia * 3 + 2] ?? 0
  const bx = positions[ib * 3] ?? 0
  const by = positions[ib * 3 + 1] ?? 0
  const bz = positions[ib * 3 + 2] ?? 0
  const cx = positions[ic * 3] ?? 0
  const cy = positions[ic * 3 + 1] ?? 0
  const cz = positions[ic * 3 + 2] ?? 0
  const ux = bx - ax
  const uy = by - ay
  const uz = bz - az
  const vx = cx - ax
  const vy = cy - ay
  const vz = cz - az
  return {
    x: uy * vz - uz * vy,
    y: uz * vx - ux * vz,
    z: ux * vy - uy * vx,
  }
}

function sweep(
  profile: P2[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
  ox: number,
  oz: number,
  a0: number,
  a1: number,
  face: 'noseIn' | 'outerOut',
) {
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz) || 1
  const tx = dx / len
  const tz = dz / len
  const steps = Math.max(2, Math.ceil(len / 0.028))
  const jaw = 0.075
  const n = profile.length
  const positions: number[] = []
  const uvs: number[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const distS = t * len
    const distE = (1 - t) * len
    let nose = 0
    if (distS < jaw) nose += Math.sin(a0) * (1 - distS / jaw) * 0.03
    if (distE < jaw) nose -= Math.sin(a1) * (1 - distE / jaw) * 0.03
    const x = ax + tx * distS
    const z = az + tz * distS
    for (const p of profile) {
      const weight = Math.max(0, 1 - p.u / 0.05)
      const along = nose * weight
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
  const cap = (ring: number, dir: number) => {
    const base = ring * n
    const fan: number[] = []
    for (let p = 1; p < n - 1; p++) fan.push(base, base + p, base + p + 1)
    const ia = fan[0] ?? 0
    const ib = fan[1] ?? 0
    const ic = fan[2] ?? 0
    const nm = triNormal(positions, ia, ib, ic)
    if (nm.x * tx * dir + nm.z * tz * dir < 0) {
      for (let i = 0; i < fan.length; i += 3) {
        const tmp = fan[i + 1] ?? 0
        fan[i + 1] = fan[i + 2] ?? 0
        fan[i + 2] = tmp
      }
    }
    index.push(...fan)
  }
  cap(0, -1)
  cap(steps, 1)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(index)
  geo.computeVertexNormals()

  let sample = 0
  if (face === 'outerOut') {
    let best = -1
    profile.forEach((p, i) => {
      if (p.u > best) {
        best = p.u
        sample = i
      }
    })
  } else {
    let best = 99
    profile.forEach((p, i) => {
      if (p.u < best) {
        best = p.u
        sample = i
      }
    })
  }
  const mid = Math.floor(steps / 2) * n + sample
  const nm = geo.getAttribute('normal')
  const dot = (nm.getX(mid) || 0) * ox + (nm.getZ(mid) || 0) * oz
  const wantOut = face === 'outerOut'
  if (dot > 0 !== wantOut) {
    for (let i = 0; i < index.length; i += 3) {
      const tmp = index[i + 1] ?? 0
      index[i + 1] = index[i + 2] ?? 0
      index[i + 2] = tmp
    }
    geo.setIndex(index)
    geo.computeVertexNormals()
  }
  return geo
}

function addSweep(
  group: THREE.Group,
  profile: P2[],
  mat: THREE.Material,
  angle: (corner: boolean) => number,
  face: 'noseIn' | 'outerOut',
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
      face,
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

function woodBox(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
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

  const jaw = (corner: boolean) => (corner ? 0.7 : 0.48)
  addSweep(root, cushionProfile, mats.cloth, jaw, 'noseIn')
  addSweep(root, woodProfile, mats.oak, jaw, 'outerOut')

  const woodH = WOOD_TOP - WOOD_BOTTOM
  const woodY = BED + (WOOD_TOP + WOOD_BOTTOM) / 2
  const outerX = HALF_L + RAIL
  const outerZ = HALF_W + RAIL
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      root.add(
        woodBox(mats.oak, 0.256, woodH, 0.112, sx * (outerX - 0.128), woodY, sz * (outerZ - 0.056)),
        woodBox(mats.oak, 0.07, woodH, 0.142, sx * (outerX - 0.035), woodY, sz * (HALF_W - CORNER_INSET + 0.079)),
      )
    }
  }
  root.add(
    woodBox(mats.oak, SIDE_HALF * 2 - 0.006, woodH, 0.06, 0, woodY, outerZ - 0.03),
    woodBox(mats.oak, SIDE_HALF * 2 - 0.006, woodH, 0.06, 0, woodY, -(outerZ - 0.03)),
  )

  const apronT = 0.03
  const apronH = 0.155
  const apronTop = BED + WOOD_BOTTOM - 0.002
  const apronBottom = apronTop - apronH
  const apronY = (apronTop + apronBottom) / 2
  const recess = mats.oak.clone()
  recess.color = new THREE.Color('#c9b48e')
  const apron = [
    { x: -0.72, z: outerZ - apronT / 2, w: 1.12, d: apronT },
    { x: 0.72, z: outerZ - apronT / 2, w: 1.12, d: apronT },
    { x: -0.72, z: -(outerZ - apronT / 2), w: 1.12, d: apronT },
    { x: 0.72, z: -(outerZ - apronT / 2), w: 1.12, d: apronT },
    { x: outerX - apronT / 2, z: 0, w: apronT, d: 0.96 },
    { x: -(outerX - apronT / 2), z: 0, w: apronT, d: 0.96 },
  ]
  for (const s of apron) {
    root.add(woodBox(mats.oak, s.w, apronH, s.d, s.x, apronY, s.z))
    const faceOut = s.w > s.d
    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(
        faceOut ? s.w - 0.1 : 0.01,
        apronH - 0.05,
        faceOut ? 0.01 : s.d - 0.1,
      ),
      recess,
    )
    const stick = apronT / 2 + 0.004
    inset.position.set(
      s.x + (faceOut ? 0 : Math.sign(s.x) * stick),
      apronY,
      s.z + (faceOut ? Math.sign(s.z) * stick : 0),
    )
    root.add(inset)
  }

  const legH = apronBottom - 0.002
  const legGeo = new THREE.CylinderGeometry(0.045, 0.055, legH - 0.04, 4)
  legGeo.rotateY(Math.PI / 4)
  legGeo.translate(0, (legH - 0.04) / 2 + 0.04, 0)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, mats.oak)
      leg.position.set(sx * 1.16, 0, sz * 0.55)
      leg.castShadow = true
      leg.receiveShadow = true
      root.add(leg)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.13), mats.oak)
      foot.position.set(sx * 1.16, 0.02, sz * 0.55)
      foot.castShadow = true
      root.add(foot)
    }
  }

  const dark = new THREE.MeshStandardMaterial({ color: '#141311', roughness: 0.9 })
  const hw = tableHardware()
  for (const p of hw.pockets) {
    const leather = new THREE.Mesh(
      sackGeometry(p.corner ? 0.05 : 0.058, p.corner ? 0.042 : 0.04),
      mats.leather,
    )
    const dropX = p.corner ? Math.sign(p.ox) * 1.34 : 0
    const dropZ = p.corner ? Math.sign(p.oz) * 0.68 : Math.sign(p.oz) * 0.76
    leather.position.set(dropX, apronBottom - 0.002, dropZ)
    leather.rotation.y = Math.atan2(p.ox, p.oz)
    leather.castShadow = true
    leather.receiveShadow = true
    root.add(leather)
    const liner = new THREE.Mesh(
      new THREE.BoxGeometry(p.corner ? 0.07 : 0.11, 0.1, p.corner ? 0.07 : 0.08),
      dark,
    )
    liner.position.set(p.x, BED - 0.055, p.z)
    root.add(liner)
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
  return { root, lights: lamp.lights }
}

function buildLamp(mats: TableMaterials) {
  const group = new THREE.Group()
  const shadeGeo = shadeGeometry()
  const xs = [-0.48, 0, 0.48]
  const y = BED + 0.72
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
      new THREE.SphereGeometry(0.028, 12, 8),
      new THREE.MeshStandardMaterial({
        color: '#ffd7a4',
        emissive: '#ffb15a',
        emissiveIntensity: 0.45,
        roughness: 0.4,
      }),
    )
    bulb.position.set(x, y + 0.05, 0)
    group.add(bulb)
    const spot = new THREE.SpotLight('#ffc48a', 7, 5.5, 0.68, 0.62, 1)
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
